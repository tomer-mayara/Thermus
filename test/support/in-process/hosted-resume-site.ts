import type { TestContext } from 'node:test';
import { gatewayStartOf } from '../../../src/app/mcp-gateway-composition.ts';
import { withTenantProvisioning } from '../../../src/app/tenant-provisioning.ts';
import { loadTenantProvisioningSettings } from '../../../src/runtime/config/mcp-tenants-config.ts';
import type { TenantState } from '../../../src/tenancy/tenants/tenant-registry-store.ts';
import { TenantLookup } from '../../../src/tenancy/tenants/tenant-lookup.ts';
import { TenantRequests } from '../../../src/tenancy/tenants/tenant-requests.ts';
import { RenderFake, type FakeService, type RenderRoute } from '../doubles/render/render-fake.ts';
import { TenantTableFake } from '../doubles/tenants/tenant-table-fake.ts';
import { VirtualClock } from '../doubles/tenants/virtual-clock.ts';
import { workosClientFor } from '../doubles/workos/workos-fake-api.ts';
import { controlPlaneAuthkitIssuer, controlPlaneEnvironment, controlPlanePublicBaseUrl, controlPlaneTenantSettingsOf, tenantImageDigest } from '../fixtures/control-plane-tenants.ts';
import { gatewayOrganization, serveHostedGatewaySite } from './hosted-gateway-site.ts';

const freePlan = '0.5c-512mb';
const REAL_WAIT_LIMIT_MS = 10_000;
// The tick of the sweeps never comes: the wait of their clock ends only with the close.
const quietSweepClock = {
  now: () => 0,
  sleep: (_ms: number, signal: AbortSignal) => new Promise<void>((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })),
};

export type HostedResumeSite = Awaited<ReturnType<typeof openHostedResumeSite>>;

// The control plane of the gateway sites with MCP_TENANTS_ENABLED on, composed as app composes it from its settings:
// the gateway parts, the provisioner loop, the tenant sweeps, and the resume operation of the gateway on the Render
// adapter, over one fake of the tenants table and the fake of the Render API. The provisioner, the Render adapter, the
// fake Render API, and the fake table share one virtual clock, which each wait of the loop moves on; the sweeps never
// reach their tick. The service of the tenant of organization A has the address of its fake upstream, so a live row
// leads the gateway to that upstream.
export async function openHostedResumeSite(t: TestContext) {
  const platformClock = new VirtualClock(1);
  const table = new TenantTableFake(platformClock.now);
  const { render: renderSettings } = loadTenantProvisioningSettings(controlPlaneEnvironment);
  const render = new RenderFake({ apiKey: renderSettings.apiKey, ownerId: renderSettings.ownerId, now: platformClock.now });
  const site = await serveHostedGatewaySite(t, ({ keys, internalUrl, clock, world, storage, log }) => {
    const environment = { ...controlPlaneEnvironment, ...controlPlaneTenantSettingsOf(keys, internalUrl) };
    const tenants = { requests: new TenantRequests(table, 25), lookup: new TenantLookup(table, clock), provisioning: table, gateway: table, fleet: table };
    const tenancy = withTenantProvisioning({ ...storage, tenants }, {
      settings: loadTenantProvisioningSettings(environment), publicBaseUrl: controlPlanePublicBaseUrl, authkitIssuer: controlPlaneAuthkitIssuer,
      logger: log, workos: workosClientFor(world.fake), fetch: render.fetch, clock: platformClock, sweepClock: quietSweepClock,
    });
    return { storage: tenancy.storage, gateway: gatewayStartOf(environment).partsOn(tenancy) };
  });
  const until = async (condition: () => boolean, what: string): Promise<void> => {
    const deadline = performance.now() + REAL_WAIT_LIMIT_MS;
    while (!condition()) {
      if (performance.now() > deadline) throw new Error(`The control plane did not reach ${what}. Rows: ${JSON.stringify([...table.rows.values()])}. Log: ${site.log.lines.join(' | ')}`);
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
  };

  return {
    ...site, table, render, platformClock,
    /**
     * A tenant of organization A that the idle sweep suspended: its Render service, suspended, with its last deploy from
     * before the suspend still live, at the address of the fake upstream, and its suspended row.
     */
    suspendedTenant: (): FakeService => {
      const name = `thermus-tenant-${gatewayOrganization.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
      const port = Number(new URL(site.tenant.origin).port);
      const service = render.addService(name, { outcome: 'live', readsLeft: 0 }, { host: 'localhost', port });
      service.suspended = true;
      table.put({
        organizationId: gatewayOrganization, state: 'suspended', serviceName: name, serviceId: service.id, internalUrl: `http://localhost:${port}`,
        plan: freePlan, appliedPlan: freePlan, imageDigest: tenantImageDigest, lastActiveAt: '2026-10-01T09:00:00.000Z',
      });
      return service;
    },
    untilState: (state: TenantState): Promise<void> => until(() => table.stateOf(gatewayOrganization) === state, `the state ${state}`),
    untilRenderRequests: (route: RenderRoute, count: number): Promise<void> => until(() => render.requestsOf(route).length >= count, `${count} ${route} requests`),
  };
}
