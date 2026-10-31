import type { TestContext } from 'node:test';
import { tenantPlatformOf } from '../../../../src/app/tenant-provisioning.ts';
import { startTenantSweeps } from '../../../../src/app/tenant-sweeps.ts';
import { loadTenantProvisioningSettings } from '../../../../src/runtime/config/mcp-tenants-config.ts';
import { OperatorLogSpy } from '../../../support/doubles/application/operator-log-spy.ts';
import { RenderFake, type FakeService } from '../../../support/doubles/render/render-fake.ts';
import { TenantFleetStoreFake } from '../../../support/doubles/tenants/tenant-fleet-store-fake.ts';
import { VirtualClock } from '../../../support/doubles/tenants/virtual-clock.ts';
import { workosClientFor } from '../../../support/doubles/workos/workos-fake-api.ts';
import { WorkOSFake } from '../../../support/doubles/workos/workos-fake.ts';
import { controlPlaneEnvironment, controlPlanePublicBaseUrl, tenantImageDigest } from '../../../support/fixtures/control-plane-tenants.ts';
import { TickClock } from './tick-clock.ts';

// The tenant sweeps of the control plane as app composes them from the settings of the control plane, with the WorkOS
// fake at the WorkOS SDK, the fake of the Render API at the fetch of the Render adapter, a fake of the tenant registry,
// a wall clock that gives the ticks of one test, and a spy of the operator log.

export const organizationA = 'org_01JSWEEPAAAAAAAAAAAAAAAAAA';
export const organizationB = 'org_01JSWEEPBBBBBBBBBBBBBBBBBB';
export const organizationC = 'org_01JSWEEPCCCCCCCCCCCCCCCCCC';
export const organizationD = 'org_01JSWEEPDDDDDDDDDDDDDDDDDD';
// Monday 2 November 2026, one minute before the default sweep hour of 04:00 UTC: the first tick is a sweep day.
export const mondayBeforeTheSweep = Date.parse('2026-11-02T03:59:00Z');
export const tuesdayBeforeTheSweep = Date.parse('2026-11-03T03:59:00Z');
export const wednesdayBeforeTheSweep = Date.parse('2026-11-04T03:59:00Z');
export const freePlan = '0.5c-512mb';

const REAL_WAIT_LIMIT_MS = 10_000;
// A live tenant served its last call on Sunday 1 November 2026, so the idle sweep of these days leaves it.
const recentUse = '2026-11-01T12:00:00.000Z';

/** The facts of a live tenant row that a test can choose: its plan, its last use, and its creation. */
export interface LiveTenantRow {
  readonly plan?: string;
  readonly lastActiveAt?: string | null;
  readonly createdAt?: string;
}

export function serviceNameOf(organizationId: string): string {
  return `thermus-tenant-${organizationId.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
}

export class SweepHarness {
  readonly settings = loadTenantProvisioningSettings(controlPlaneEnvironment);
  readonly platformClock = new VirtualClock();
  readonly render = new RenderFake({ apiKey: this.settings.render.apiKey, ownerId: this.settings.render.ownerId, now: this.platformClock.now });
  readonly store = new TenantFleetStoreFake();
  readonly log = new OperatorLogSpy();
  readonly workos: WorkOSFake;

  private constructor(workos: WorkOSFake) {
    this.workos = workos;
  }

  /** WorkOS knows the given organizations, and the registry is empty. */
  static async start(t: TestContext, organizations: readonly string[]): Promise<SweepHarness> {
    return new SweepHarness(await WorkOSFake.start(t, controlPlanePublicBaseUrl, organizations));
  }

  /** A live tenant of the organization: its Render service and its registry row, a free tenant with a recent call unless the row says else. */
  liveTenant(organizationId: string, row: LiveTenantRow = {}): FakeService {
    const name = serviceNameOf(organizationId);
    const service = this.render.addService(name);
    const plan = row.plan ?? freePlan;
    this.store.put({
      organizationId, state: 'live', serviceName: name, serviceId: service.id, internalUrl: `http://${service.slug}:8080`,
      plan, appliedPlan: plan, imageDigest: tenantImageDigest, lastActiveAt: row.lastActiveAt === undefined ? recentUse : row.lastActiveAt,
      ...(row.createdAt === undefined ? {} : { createdAt: row.createdAt }),
    });
    return service;
  }

  /** Runs the sweeps of one daily tick from the given time, then stops them as the application close does. */
  async runOneTick(startMs: number): Promise<void> {
    const clock = new TickClock(startMs, 1);
    const platform = tenantPlatformOf({ settings: this.settings, store: this.store, fetch: this.render.fetch, clock: this.platformClock });
    const sweeps = startTenantSweeps({
      settings: this.settings, platform, fleet: this.store, workos: workosClientFor(this.workos.fake), logger: this.log, sweepClock: clock,
    });
    try {
      await this.until(() => clock.blocked, 'the end of one tick');
    } finally {
      await sweeps.close();
    }
  }

  linesWith(text: string): string[] {
    return this.log.lines.filter((line) => line.includes(text));
  }

  errorLines(): string[] {
    return this.log.lines.filter((line) => line.startsWith('ERROR '));
  }

  private async until(condition: () => boolean, what: string): Promise<void> {
    const deadline = performance.now() + REAL_WAIT_LIMIT_MS;
    while (!condition()) {
      if (performance.now() > deadline) throw new Error(`The sweeps did not reach ${what}. Log: ${this.log.lines.join(' | ')}`);
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
  }
}
