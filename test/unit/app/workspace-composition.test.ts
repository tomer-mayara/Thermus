import assert from 'node:assert/strict';
import { test } from 'node:test';
import { servedByControlPlane, signupTenantsOf, workspacePartsOf, workspaceTenantsOf } from '../../../src/app/workspace-composition.ts';
import type { GatewayRoute, GatewayTenantRequest, GatewayTenants } from '../../../src/interfaces/mcp/mcp-gateway-tenants.ts';
import type { TenantCountResult } from '../../../src/tenancy/tenants/tenant-lookup.ts';
import type { TenantState } from '../../../src/tenancy/tenants/tenant-registry-store.ts';
import type { TenantRequestResult } from '../../../src/tenancy/tenants/tenant-requests.ts';

// A stub of the registry port of the gateway that records each call.
function gatewayPortOf(route: GatewayRoute, request: GatewayTenantRequest = { status: 'requested' }): Pick<GatewayTenants, 'find' | 'request'> & { readonly calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    find: async (organizationId) => { calls.push(`find ${organizationId}`); return route; },
    request: async (organizationId) => { calls.push(`request ${organizationId}`); return request; },
  };
}

test('Given a row in the registry copy, when the portal asks for the workspace state, then it gets the state of the row and no tenant request', async () => {
  for (const state of ['requested', 'creating', 'deploying', 'live', 'suspended', 'failed', 'deleted'] as const) {
    const port = gatewayPortOf({ status: 'found', state, internalUrl: null, sinceChangeMs: 0 });
    assert.equal(await workspaceTenantsOf(port).stateOf('org_A'), state);
    assert.deepEqual(port.calls, ['find org_A']);
  }
});

test('Given no usable registry copy, when the portal asks for the workspace state, then it is unavailable and no tenant request goes', async () => {
  const port = gatewayPortOf({ status: 'unavailable' });
  assert.equal(await workspaceTenantsOf(port).stateOf('org_A'), 'unavailable');
  assert.deepEqual(port.calls, ['find org_A']);
});

test('Given an organization without a row, when the portal asks for the workspace state, then the tenant request of the gateway path answers it', async () => {
  const answers: ReadonlyArray<readonly [GatewayTenantRequest, string]> = [
    [{ status: 'requested' }, 'requested'],
    [{ status: 'full' }, 'full'],
    [{ status: 'unavailable' }, 'unavailable'],
    [{ status: 'present', state: 'creating' }, 'creating'],
  ];
  for (const [request, state] of answers) {
    const port = gatewayPortOf({ status: 'absent' }, request);
    assert.equal(await workspaceTenantsOf(port).stateOf('org_A'), state);
    assert.deepEqual(port.calls, ['find org_A', 'request org_A']);
  }
});

test('Given MCP_TENANTS_ENABLED off, when the portal asks for the workspace state, then the workspace is live, because the control plane serves the tools itself', async () => {
  assert.equal(await servedByControlPlane.stateOf('org_A'), 'live');
});

// Stubs of the lookup copy and of the tenant request with the cap, with a record of each call.
function registryOf(count: TenantCountResult, request: TenantRequestResult = { status: 'requested' }, freeTenantLimit = 2) {
  const calls: string[] = [];
  return {
    calls,
    lookup: { countByState: async () => { calls.push('count'); return count; } },
    requests: {
      hasPlaceIn: (rowsByState: ReadonlyMap<TenantState, number>) => { calls.push('cap'); return [...rowsByState.values()].reduce((sum, rows) => sum + rows, 0) < freeTenantLimit; },
      request: async (organizationId: string) => { calls.push(`request ${organizationId}`); return request; },
    },
  };
}

test('Given MCP_TENANTS_ENABLED on, when signup asks for a place, then the cap of the registry copy answers open, full, or unavailable', async () => {
  const open = registryOf({ status: 'counted', rowsByState: new Map([['live', 1]]) });
  assert.equal(await signupTenantsOf(open, true).place(), 'open');
  assert.deepEqual(open.calls, ['count', 'cap']);
  const full = registryOf({ status: 'counted', rowsByState: new Map([['live', 1], ['requested', 1]]) });
  assert.equal(await signupTenantsOf(full, true).place(), 'full');
  const unreadable = registryOf({ status: 'unavailable' });
  assert.equal(await signupTenantsOf(unreadable, true).place(), 'unavailable');
  assert.deepEqual(unreadable.calls, ['count']);
});

test('Given MCP_TENANTS_ENABLED off, when signup asks for a place, then the place is open without a registry read, because FREE_TENANT_LIMIT bounds only tenant containers', async () => {
  const registry = registryOf({ status: 'unavailable' });
  assert.equal(await signupTenantsOf(registry, false).place(), 'open');
  assert.deepEqual(registry.calls, []);
});

test('Given a new organization, when signup requests its tenant, then the tenant request inside the cap answers with its status, with the switch on or off', async () => {
  for (const capped of [true, false]) {
    for (const result of [{ status: 'requested' }, { status: 'full' }, { status: 'unavailable' }, { status: 'present', state: 'live' }] as const) {
      const registry = registryOf({ status: 'unavailable' }, result);
      assert.equal(await signupTenantsOf(registry, capped).request('org_NEW'), result.status);
      assert.deepEqual(registry.calls, ['request org_NEW']);
    }
  }
});

// The registry port of the gateway with a suspended row; the portal never resumes a tenant or writes its activity.
function suspendedPort(): GatewayTenants {
  return {
    ...gatewayPortOf({ status: 'found', state: 'suspended', internalUrl: 'http://thermus-tenant-org-a:8080', sinceChangeMs: 0 }),
    resume: async () => assert.fail('The portal must not resume a tenant.'),
    recordActive: () => assert.fail('The portal must not write the activity of a tenant.'),
  };
}

const logger = { info: () => {}, error: () => {} };

test('Given FREE_TENANT_IDLE_DAYS, when the portal asks for the view of a suspended tenant, then the notice of the pause names those days, and 14 without the setting', async () => {
  const thirty = workspacePartsOf({ gateway: { tenants: suspendedPort() }, logger, idleDays: 30 });
  assert.deepEqual(await thirty.statuses.viewOf('org_A'), { state: 'suspended', ready: true, message: 'Your workspace was paused after 30 days without use. It restarts on the next request, which can take about a minute.' });
  const preset = workspacePartsOf({ gateway: { tenants: suspendedPort() }, logger });
  assert.deepEqual(await preset.statuses.viewOf('org_A'), { state: 'suspended', ready: true, message: 'Your workspace was paused after 14 days without use. It restarts on the next request, which can take about a minute.' });
});
