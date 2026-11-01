import assert from 'node:assert/strict';
import test from 'node:test';
import type { TestContext } from 'node:test';
import { tenantPlatformOf } from '../../../src/app/tenant-provisioning.ts';
import { startTenantSweeps } from '../../../src/app/tenant-sweeps.ts';
import { loadTenantProvisioningSettings } from '../../../src/runtime/config/mcp-tenants-config.ts';
import { createPgSettingsRuntime } from '../../../src/runtime/sql/bounded-sql-runtime.ts';
import { PgTenantFleetStore } from '../../../src/tenancy/tenants/pg-tenant-fleet-store.ts';
import { PgTenantProvisioningStore } from '../../../src/tenancy/tenants/pg-tenant-provisioning-store.ts';
import { OperatorLogSpy } from '../../support/doubles/application/operator-log-spy.ts';
import { RenderFake, type FakeService, type RenderRequest, type RenderRoute } from '../../support/doubles/render/render-fake.ts';
import { VirtualClock } from '../../support/doubles/tenants/virtual-clock.ts';
import { workosClientFor } from '../../support/doubles/workos/workos-fake-api.ts';
import { WorkOSFake } from '../../support/doubles/workos/workos-fake.ts';
import { controlPlaneEnvironment, controlPlanePublicBaseUrl } from '../../support/fixtures/control-plane-tenants.ts';
import { postgresSettingsSite } from '../../support/in-process/postgres-settings-site.ts';
import { serviceNameOf } from './fixtures/sweep-harness.ts';
import { TickClock } from './fixtures/tick-clock.ts';

// The SO-12 release rehearsal of 31 October 2026 (release record, section 3.7, item 6): during each deploy of the
// control plane, Render keeps the old instance for about 120 s after the new deploy is live, so two instances run the
// tenant sweeps, and a daily tick inside that time comes in both. Each control plane of these cases has its own pool on
// one disposable PostgreSQL 17, as two instances have; both call one fake of the Render API and one WorkOS fake, and
// both reach the same tick at once.

type Site = Awaited<ReturnType<typeof postgresSettingsSite>>;

const settings = loadTenantProvisioningSettings(controlPlaneEnvironment);
const organizationA = 'org_01JTICKAAAAAAAAAAAAAAAAAAA';
const organizationB = 'org_01JTICKBBBBBBBBBBBBBBBBBBB';
// One minute before the default sweep hour of 04:00 UTC on Monday 2 and Tuesday 3 November 2026.
const mondayBeforeTheSweep = Date.parse('2026-11-02T03:59:00Z');
const tuesdayBeforeTheSweep = Date.parse('2026-11-03T03:59:00Z');
// 15 days before the tick of Tuesday, so the idle sweep of 14 days suspends the tenant; and a call one day before it.
const fifteenDaysBeforeTuesday = '2026-10-19T12:00:00.000Z';
const recentUse = '2026-11-02T12:00:00.000Z';
const WAIT_LIMIT_MS = 30_000;
// A busy host can take more than the production bounds of the SQL runtime to open the first connection of a pool, and a
// claim without an answer waits 10 s before it tries again; these bounds keep the claims of the cases answered.
const busyHost = { acquisitionMs: 5_000, operationMs: 10_000, statementMs: 8_000 };

interface ControlPlane {
  readonly log: OperatorLogSpy;
  /** The Render calls of this control plane, in order. */
  readonly sent: RenderRequest[];
  /** True when the sweeps of this control plane are past the tick and wait for the next one. */
  ended(): boolean;
}

// One deploy of the control plane while its two instances run: the systems that they share, one tenant registry on
// disposable PostgreSQL 17, one fake of the Render API, and one WorkOS fake.
class Deploy {
  readonly render = new RenderFake({ apiKey: settings.render.apiKey, ownerId: settings.render.ownerId });
  readonly workos: WorkOSFake;
  readonly #t: TestContext;
  readonly #site: Site;

  private constructor(t: TestContext, site: Site, workos: WorkOSFake) {
    this.#t = t;
    this.#site = site;
    this.workos = workos;
  }

  /** The registry is empty, and WorkOS knows the given organizations. */
  static async start(t: TestContext, organizations: readonly string[]): Promise<Deploy> {
    return new Deploy(t, await postgresSettingsSite(t), await WorkOSFake.start(t, controlPlanePublicBaseUrl, organizations));
  }

  /** A live free tenant: its Render service and its registry row with the last use. */
  async liveTenant(organizationId: string, lastActiveAt: string): Promise<FakeService> {
    const service = this.render.addService(serviceNameOf(organizationId));
    await this.#site.ownerQuery(`INSERT INTO thermus_admin.tenants (organization_id, state, render_service_id, service_name, internal_url, plan, applied_plan, last_active_at)
      VALUES ('${organizationId}', 'live', '${service.id}', '${service.name}', 'http://${service.slug}:8080', '${settings.freePlan}', '${settings.freePlan}', '${lastActiveAt}')`);
    return service;
  }

  /**
   * One control plane instance: its own pool, Render adapter, and tenant sweeps on the shared registry, with a wall
   * clock from startMs whose first `sleeps` waits end at once: one for the tick, and one for each later claim of the
   * tick. The fetch of the instance keeps each Render request that it sends; the fake records the request before its
   * first wait.
   */
  instance(startMs: number, sleeps = 1): ControlPlane {
    const runtime = createPgSettingsRuntime({ ...this.#site.connection, bounds: busyHost });
    const log = new OperatorLogSpy();
    const sent: RenderRequest[] = [];
    const fetch: typeof globalThis.fetch = (input, init) => {
      const before = this.render.requests.length;
      const answer = this.render.fetch(input, init);
      sent.push(...this.render.requests.slice(before));
      return answer;
    };
    const clock = new TickClock(startMs, sleeps);
    const platform = tenantPlatformOf({ settings, store: new PgTenantProvisioningStore(runtime), fetch, clock: new VirtualClock() });
    const sweeps = startTenantSweeps({
      settings, platform, fleet: new PgTenantFleetStore(runtime), workos: workosClientFor(this.workos.fake), logger: log, sweepClock: clock,
    });
    this.#t.after(async () => {
      await sweeps.close();
      await runtime.close();
    });
    return { log, sent, ended: () => clock.blocked };
  }

  /** The two instances of the deploy, which reach the same tick. */
  instances(startMs: number): readonly [ControlPlane, ControlPlane] {
    return [this.instance(startMs), this.instance(startMs)];
  }

  stateOf(organizationId: string): Promise<string> {
    return this.#site.ownerQuery(`SELECT state FROM thermus_admin.tenants WHERE organization_id = '${organizationId}'`);
  }

  /** Each claimed tick as "<UTC time> <holder>". */
  async claimedTicks(): Promise<string[]> {
    const text = await this.#site.ownerQuery("SELECT to_char(tick_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') || ' ' || claimed_by FROM thermus_admin.tenant_sweep_ticks ORDER BY tick_at");
    return text === '' ? [] : text.split('\n');
  }

  /** The registry as before the tick migration. */
  async dropTheTableOfTheTicks(): Promise<void> {
    await this.#site.ownerQuery('DROP TABLE thermus_admin.tenant_sweep_ticks');
  }

  /**
   * Holds the Render calls of the route until the other instance is past the tick or sends that call too, so a second
   * run of the tick cannot end before the first one, and both runs reach Render. It gives the instance that sent the
   * first call of the route, and the other one.
   */
  async runTheTickWhileHeld(planes: readonly [ControlPlane, ControlPlane], route: RenderRoute): Promise<{ readonly runner: ControlPlane; readonly other: ControlPlane }> {
    const held = this.render.hold(route);
    await until(() => this.render.requestsOf(route).length > 0, `${route} call`);
    const [one, two] = planes;
    const { runner, other } = one.sent.some((request) => request.route === route) ? { runner: one, other: two } : { runner: two, other: one };
    await until(() => other.ended() || this.render.requestsOf(route).length > 1, 'the end of the tick in the other control plane');
    held.release();
    await until(() => runner.ended(), 'the end of the tick');
    return { runner, other };
  }
}

async function until(condition: () => boolean, what: string): Promise<void> {
  const deadline = performance.now() + WAIT_LIMIT_MS;
  while (!condition()) {
    assert.ok(performance.now() < deadline, `No ${what} within ${WAIT_LIMIT_MS} ms`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

// The tick claim holder that the start line of a control plane names.
function holderOf(plane: ControlPlane): string | undefined {
  return plane.log.lines.map((line) => /tick claim holder ([0-9a-f-]{36})\.$/.exec(line)?.[1]).find((holder) => holder !== undefined);
}

function linesOf(planes: readonly ControlPlane[], prefix: string): string[] {
  return planes.flatMap((plane) => plane.log.lines.filter((line) => line.startsWith(prefix)));
}

function leaveLine(tick: string): string {
  return `INFO The tenant sweeps leave the tick of ${tick}: another instance of the control plane claimed it first.`;
}

test('Given two control planes on one tenant registry and one idle free tenant, when the daily tick comes in both, then one control plane runs the tick: Render gets one suspend call, the log has one idle sweep line and one fleet summary line, and the other control plane leaves the tick with one line', { timeout: 120_000 }, async (t) => {
  const deploy = await Deploy.start(t, [organizationA, organizationB]);
  const idle = await deploy.liveTenant(organizationA, fifteenDaysBeforeTuesday);
  await deploy.liveTenant(organizationB, recentUse);
  const planes = deploy.instances(tuesdayBeforeTheSweep);

  const { runner, other } = await deploy.runTheTickWhileHeld(planes, 'suspend service');

  assert.deepEqual(deploy.render.requestsOf('suspend service').map((request) => request.path), [`/services/${idle.id}/suspend`], 'One suspend call');
  assert.deepEqual([await deploy.stateOf(organizationA), await deploy.stateOf(organizationB)], ['suspended', 'live']);
  assert.equal(linesOf(planes, 'INFO Idle sweep:').length, 1, 'One idle sweep line');
  assert.equal(linesOf(planes, 'INFO Tenant fleet summary:').length, 1, 'One fleet summary line');
  assert.deepEqual(other.sent, [], 'The other control plane sent no Render call');
  assert.deepEqual(other.log.lines.filter((line) => !line.startsWith('INFO The tenant sweeps run each day at')), [leaveLine('2026-11-03T04:00:00.000Z')]);
  assert.deepEqual(await deploy.claimedTicks(), [`2026-11-03 04:00 ${holderOf(runner)}`], 'One claim of the tick, by the control plane that ran it');
  assert.deepEqual(linesOf(planes, 'ERROR'), []);
});

test('Given two control planes on one tenant registry and a tenant whose organization WorkOS no longer has, when the Monday tick comes in both, then one control plane runs the tick: Render gets one delete call, and the log has one organization sweep line and one fleet summary line', { timeout: 120_000 }, async (t) => {
  const deploy = await Deploy.start(t, [organizationA, organizationB]);
  await deploy.liveTenant(organizationA, recentUse);
  const removed = await deploy.liveTenant(organizationB, recentUse);
  deploy.workos.removedOrganizationIds.add(organizationB);
  const planes = deploy.instances(mondayBeforeTheSweep);

  const { runner, other } = await deploy.runTheTickWhileHeld(planes, 'delete service');

  assert.deepEqual(deploy.render.requestsOf('delete service').map((request) => request.path), [`/services/${removed.id}`], 'One delete call');
  assert.deepEqual([await deploy.stateOf(organizationA), await deploy.stateOf(organizationB)], ['live', 'deleted']);
  assert.equal(linesOf(planes, 'INFO Organization sweep:').length, 1, 'One organization sweep line');
  assert.equal(linesOf(planes, 'INFO Tenant fleet summary:').length, 1, 'One fleet summary line');
  assert.deepEqual(other.sent, [], 'The other control plane sent no Render call');
  assert.deepEqual(other.log.lines.filter((line) => !line.startsWith('INFO The tenant sweeps run each day at')), [leaveLine('2026-11-02T04:00:00.000Z')]);
  assert.deepEqual(await deploy.claimedTicks(), [`2026-11-02 04:00 ${holderOf(runner)}`]);
  assert.deepEqual(linesOf(planes, 'ERROR'), []);
});

test('Given a control plane whose tenant registry has no table of the ticks, as before its migration, when the daily tick comes, then the three claims of the tick fail, the sweeps run no step and send no Render call, and the operator gets one stop line', { timeout: 120_000 }, async (t) => {
  const deploy = await Deploy.start(t, [organizationA]);
  await deploy.liveTenant(organizationA, fifteenDaysBeforeTuesday);
  await deploy.dropTheTableOfTheTicks();
  const plane = deploy.instance(tuesdayBeforeTheSweep, 3);

  await until(() => plane.ended(), 'the end of the tick');

  assert.deepEqual(plane.sent, [], 'No Render call');
  assert.equal(await deploy.stateOf(organizationA), 'live');
  assert.deepEqual(plane.log.lines.filter((line) => !line.startsWith('INFO The tenant sweeps run each day at')), [
    `ERROR Tenant sweep tick stopped: ${JSON.stringify({ tick: '2026-11-03T04:00:00.000Z', claims: 3, reason: 'The tenant registry did not answer the claim of the tick' })}`,
  ]);
});
