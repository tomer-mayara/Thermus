import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TenantState } from '../../../src/tenancy/tenants/tenant-registry-store.ts';
import { TenantRequests } from '../../../src/tenancy/tenants/tenant-requests.ts';
import { TenantRegistryStoreFake } from './fixtures/tenant-registry-store-fake.ts';

const allStates: readonly TenantState[] = ['requested', 'creating', 'deploying', 'live', 'suspended', 'failed', 'deleted'];

function registryWith(rows: Readonly<Record<string, TenantState>>): TenantRegistryStoreFake {
  const store = new TenantRegistryStoreFake();
  for (const [organizationId, state] of Object.entries(rows)) store.rows.set(organizationId, { state, internalUrl: null });
  return store;
}

test('Given an organization without a row and a free place, when it requests a tenant, then one requested row is inserted', async () => {
  const store = registryWith({});
  assert.deepEqual(await new TenantRequests(store, 25).request('org_A'), { status: 'requested' });
  assert.deepEqual([...store.rows], [['org_A', { state: 'requested', internalUrl: null }]]);
});

test('Given a row for the organization in any state, when it requests a tenant again, then the row stays as it is and the result names its state', async () => {
  for (const state of allStates) {
    const store = registryWith({ org_A: state });
    const before = store.rows.get('org_A');
    assert.deepEqual(await new TenantRequests(store, 25).request('org_A'), { status: 'present', state });
    assert.equal(store.rows.get('org_A'), before);
    assert.equal(store.rows.size, 1);
  }
});

test('Given FREE_TENANT_LIMIT rows that hold a place, when a new organization requests a tenant, then nothing is inserted and the cap is full', async () => {
  const store = registryWith({ org_A: 'requested', org_B: 'creating', org_C: 'deploying', org_D: 'live', org_E: 'suspended' });
  assert.deepEqual(await new TenantRequests(store, 5).request('org_F'), { status: 'full' });
  assert.equal(store.rows.has('org_F'), false);
  assert.deepEqual(await new TenantRequests(store, 6).request('org_F'), { status: 'requested' });
});

test('Given failed and deleted rows, when a new organization requests a tenant, then those rows hold no place under the cap', async () => {
  const store = registryWith({ org_A: 'failed', org_B: 'deleted', org_C: 'live' });
  assert.deepEqual(await new TenantRequests(store, 2).request('org_D'), { status: 'requested' });
  assert.deepEqual(await new TenantRequests(store, 2).request('org_E'), { status: 'full' });
});

test('Given FREE_TENANT_LIMIT 0, when organizations request tenants, then a new organization gets the full cap and an existing row stays present', async () => {
  const store = registryWith({ org_A: 'live' });
  const requests = new TenantRequests(store, 0);
  assert.deepEqual(await requests.request('org_B'), { status: 'full' });
  assert.deepEqual(await requests.request('org_A'), { status: 'present', state: 'live' });
  assert.equal(store.rows.size, 1);
});

test('Given unavailable or unconfirmed storage, when an organization requests a tenant, then the result is unavailable and a repeat finds a committed row', async () => {
  const store = registryWith({});
  const requests = new TenantRequests(store, 25);
  for (const failure of ['unavailable', 'unconfirmed'] as const) {
    store.insertFailure = failure;
    assert.deepEqual(await requests.request('org_A'), { status: 'unavailable' });
  }
  store.insertFailure = undefined;
  store.rows.set('org_A', { state: 'requested', internalUrl: null });
  assert.deepEqual(await requests.request('org_A'), { status: 'present', state: 'requested' });
});
