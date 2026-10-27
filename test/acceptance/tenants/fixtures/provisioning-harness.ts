import { startTenantProvisioning, tenantPlatformOf } from '../../../../src/app/tenant-provisioning.ts';
import { loadTenantProvisioningSettings } from '../../../../src/runtime/config/mcp-tenants-config.ts';
import type { TenantPlatform } from '../../../../src/tenancy/tenants/tenant-platform.ts';
import { OperatorLogSpy } from '../../../support/doubles/application/operator-log-spy.ts';
import { RenderFake } from '../../../support/doubles/render/render-fake.ts';
import { TenantProvisioningStoreFake } from '../../../support/doubles/tenants/tenant-provisioning-store-fake.ts';
import { VirtualClock } from '../../../support/doubles/tenants/virtual-clock.ts';
import { controlPlaneAuthkitIssuer, controlPlaneEnvironment, controlPlanePublicBaseUrl } from '../../../support/fixtures/control-plane-tenants.ts';

// The provisioner of the control plane as app composes it from the settings of the control plane, with a fake of the
// Render API at its fetch, a fake of the tenant registry, a virtual clock, and a spy of the operator log.

export const organizationA = 'org_01JTENANTAAAAAAAAAAAAAAAA';
export const organizationB = 'org_01JTENANTBBBBBBBBBBBBBBBB';
export const productionServiceId = 'srv-db8mnqg473hc739d529g';

const REAL_WAIT_LIMIT_MS = 10_000;

export function serviceNameOf(organizationId: string): string {
  return `thermus-tenant-${organizationId.toLowerCase()}`;
}

export class ProvisioningHarness {
  readonly settings = loadTenantProvisioningSettings(controlPlaneEnvironment);
  readonly clock = new VirtualClock();
  readonly render = new RenderFake({ apiKey: this.settings.render.apiKey, ownerId: this.settings.render.ownerId, now: this.clock.now });
  readonly store = new TenantProvisioningStoreFake();
  readonly log = new OperatorLogSpy();

  /** The Render adapter as app composes it for the provisioner, with the write guard of the registry. */
  platform(): TenantPlatform {
    return tenantPlatformOf({ settings: this.settings, store: this.store, fetch: this.render.fetch, clock: this.clock });
  }

  /** Runs the provisioner loop until the condition holds, then stops it as the application close does. */
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

  /** Runs the loop until the virtual clock passes the given time. */
  runFor(virtualMs: number): Promise<void> {
    return this.runUntil(() => this.clock.now() >= virtualMs, `${virtualMs} ms of virtual time`);
  }

  /** The body of each create call that the fake Render API received. */
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
