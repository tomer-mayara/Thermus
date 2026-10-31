import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TenantState } from '../../../src/tenancy/tenants/tenant-registry-store.ts';
import { reviveTenant, TenantRequests } from '../../../src/tenancy/tenants/tenant-requests.ts';
import { TenantFleetStoreFake } from '../../support/doubles/tenants/tenant-fleet-store-fake.ts';
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

test('Given the row counts of a registry copy, when signup asks for a place before the agreement, then a place is free only while the rows that hold a place stay under FREE_TENANT_LIMIT', () => {
  const counts = (rows: Readonly<Partial<Record<TenantState, number>>>): ReadonlyMap<TenantState, number> => new Map(Object.entries(rows) as [TenantState, number][]);
  const requests = new TenantRequests(new TenantRegistryStoreFake(), 5);
  assert.equal(requests.hasPlaceIn(counts({})), true);
  assert.equal(requests.hasPlaceIn(counts({ requested: 1, creating: 1, deploying: 1, live: 1 })), true);
  assert.equal(requests.hasPlaceIn(counts({ requested: 1, creating: 1, deploying: 1, live: 1, suspended: 1 })), false);
  assert.equal(requests.hasPlaceIn(counts({ live: 4, failed: 3, deleted: 9 })), true, 'A failed or a deleted row holds no place');
  assert.equal(new TenantRequests(new TenantRegistryStoreFake(), 0).hasPlaceIn(counts({})), false, 'FREE_TENANT_LIMIT 0 closes free signup');
});

function fleetWith(rows: Readonly<Record<string, TenantState>>): TenantFleetStoreFake {
  const store = new TenantFleetStoreFake();
  for (const [organizationId, state] of Object.entries(rows)) {
    store.put({ organizationId, state, serviceName: `thermus-tenant-${organizationId}`, serviceId: `srv-${organizationId.toLowerCase().replace('_', '')}`, plan: '0.5c-512mb', imageDigest: `sha256:${'c'.repeat(64)}` });
  }
  return store;
}

test('Given a deleted row and a free place, when the tenant is revived, then the row is requested again as a new request, without its old service', async () => {
  const store = fleetWith({ org_A: 'deleted', org_B: 'live' });
  assert.deepEqual(await reviveTenant(store, 'org_A', 2), { status: 'revived' });
  const row = store.row('org_A');
  assert.deepEqual(
    { state: row.state, serviceId: row.serviceId, serviceName: row.serviceName, plan: row.plan, imageDigest: row.imageDigest },
    { state: 'requested', serviceId: null, serviceName: null, plan: null, imageDigest: null },
  );
});

test('Given a deleted row and a full cap, when the tenant is revived, then the row stays deleted and the cap is full', async () => {
  const store = fleetWith({ org_A: 'deleted', org_B: 'live', org_C: 'suspended' });
  assert.deepEqual(await reviveTenant(store, 'org_A', 2), { status: 'full' });
  assert.equal(store.stateOf('org_A'), 'deleted');
});

test('Given a row that is not deleted, or no row, when the tenant is revived, then nothing changes and the result says why', async () => {
  for (const state of allStates.filter((each) => each !== 'deleted')) {
    const store = fleetWith({ org_A: state });
    assert.deepEqual(await reviveTenant(store, 'org_A', 25), { status: 'present', state });
    assert.equal(store.stateOf('org_A'), state);
  }
  assert.deepEqual(await reviveTenant(fleetWith({}), 'org_A', 25), { status: 'absent' });
});

test('Given unavailable storage, when the tenant is revived, then the result is unavailable and the row stays deleted', async () => {
  const store = fleetWith({ org_A: 'deleted' });
  store.fleetUnavailable.add('revive');
  assert.deepEqual(await reviveTenant(store, 'org_A', 25), { status: 'unavailable' });
  assert.equal(store.stateOf('org_A'), 'deleted');
});
