import { startTenantProvisioning, tenantPlatformOf } from '../../../../src/app/tenant-provisioning.ts';
import { loadTenantProvisioningSettings } from '../../../../src/runtime/config/mcp-tenants-config.ts';
import type { TenantPlatform } from '../../../../src/tenancy/tenants/tenant-platform.ts';
import { OperatorLogSpy } from '../../../support/doubles/application/operator-log-spy.ts';
import { RenderFake } from '../../../support/doubles/render/render-fake.ts';
import { TenantProvisioningStoreFake } from '../../../support/doubles/tenants/tenant-provisioning-store-fake.ts';
import { VirtualClock } from '../../../support/doubles/tenants/virtual-clock.ts';
import { controlPlaneAuthkitIssuer, controlPlaneEnvironment, controlPlanePublicBaseUrl } from '../../../support/fixtures/control-plane-tenants.ts';

export const organizationA = 'org_01JTENANTAAAAAAAAAAAAAAAA';
export const organizationB = 'org_01JTENANTBBBBBBBBBBBBBBBB';
export const productionServiceId = 'srv-db8mnqg473hc739d529g';

const REAL_WAIT_LIMIT_MS = 10_000;

// The name rule of 27 October 2026 (SO-06): the prefix and the organization ID in lower case, each character outside
// a-z, 0-9, and hyphen as a hyphen.
export function serviceNameOf(organizationId: string): string {
  return `thermus-tenant-${organizationId.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
}

export class ProvisioningHarness {
  readonly settings = loadTenantProvisioningSettings(controlPlaneEnvironment);
  readonly clock = new VirtualClock();
  readonly render = new RenderFake({ apiKey: this.settings.render.apiKey, ownerId: this.settings.render.ownerId, now: this.clock.now });
  readonly store = new TenantProvisioningStoreFake();
  readonly log = new OperatorLogSpy();

  platform(): TenantPlatform {
    return tenantPlatformOf({ settings: this.settings, store: this.store, fetch: this.render.fetch, clock: this.clock });
  }

  async runUntil(condition: () => boolean, what: string): Promise<void> {
    const provisioning = startTenantProvisioning({
      settings: this.settings, publicBaseUrl: controlPlanePublicBaseUrl, authkitIssuer: controlPlaneAuthkitIssuer,
      store: this.store, logger: this.log, fetch: this.render.fetch, clock: this.clock,
    });
    try {
      await this.until(condition, what);
    } finally {
      await provisioning.close();
    }
  }

  runFor(virtualMs: number): Promise<void> {
    return this.runUntil(() => this.clock.now() >= virtualMs, `${virtualMs} ms of virtual time`);
  }

  createBodies(): Record<string, unknown>[] {
    return this.render.requestsOf('create service').map((request) => request.body as Record<string, unknown>);
  }

  errorLines(): string[] {
    return this.log.lines.filter((line) => line.startsWith('ERROR '));
  }

  private async until(condition: () => boolean, what: string): Promise<void> {
    const deadline = performance.now() + REAL_WAIT_LIMIT_MS;
    while (!condition()) {
      if (performance.now() > deadline) {
        const rows = JSON.stringify([...this.store.rows.values()]);
        throw new Error(`The provisioner did not reach ${what}. Rows: ${rows}. Log: ${this.log.lines.join(' | ')}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
  }
}
