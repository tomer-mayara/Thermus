import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TenantLookup } from '../../../src/tenancy/tenants/tenant-lookup.ts';
import { TenantRegistryStoreFake } from './fixtures/tenant-registry-store-fake.ts';

const address = 'http://thermus-tenant-org-a:8080';

function lookupOf(store: TenantRegistryStoreFake) {
  const clock = { now: 1_000 };
  return { clock, lookup: new TenantLookup(store, () => clock.now) };
}

function liveRegistry(): TenantRegistryStoreFake {
  const store = new TenantRegistryStoreFake();
  store.rows.set('org_A', { state: 'live', internalUrl: address });
  return store;
}

test('Given a registry row and a registry without a row, when the gateway asks, then it gets the state and the internal address, or the absence', async () => {
  const { lookup } = lookupOf(liveRegistry());
  assert.deepEqual(await lookup.find('org_A'), { status: 'found', state: 'live', internalUrl: address });
  assert.deepEqual(await lookup.find('org_B'), { status: 'absent' });
});

test('Given a read inside the bound of 10 s, when the gateway asks again, then the copy answers without a store read', async () => {
  const store = liveRegistry();
  const { lookup, clock } = lookupOf(store);
  await lookup.find('org_A');
  store.rows.set('org_A', { state: 'suspended', internalUrl: address });
  clock.now = 10_999;
  assert.deepEqual(await lookup.find('org_A'), { status: 'found', state: 'live', internalUrl: address });
  assert.deepEqual(await lookup.find('org_B'), { status: 'absent' });
  assert.equal(store.reads, 1);
});

test('Given a read at the bound of 10 s, when the gateway asks, then the lookup refreshes the copy and gives the new state', async () => {
  const store = liveRegistry();
  const { lookup, clock } = lookupOf(store);
  await lookup.find('org_A');
  store.rows.set('org_A', { state: 'suspended', internalUrl: address });
  store.rows.set('org_B', { state: 'requested', internalUrl: null });
  clock.now = 11_000;
  assert.deepEqual(await lookup.find('org_A'), { status: 'found', state: 'suspended', internalUrl: address });
  assert.deepEqual(await lookup.find('org_B'), { status: 'found', state: 'requested', internalUrl: null });
  assert.equal(store.reads, 2);
});

test('Given a failed refresh, when the copy is younger than 60 s, then the stale copy answers, and from 60 s the gateway gets a failure', async () => {
  const store = liveRegistry();
  const { lookup, clock } = lookupOf(store);
  await lookup.find('org_A');
  store.readFailure = true;
  for (const now of [11_000, 40_000, 60_999]) {
    clock.now = now;
    assert.deepEqual(await lookup.find('org_A'), { status: 'found', state: 'live', internalUrl: address });
  }
  assert.equal(store.reads, 4, 'Each ask after the bound tries a refresh');
  clock.now = 61_000;
  assert.deepEqual(await lookup.find('org_A'), { status: 'unavailable' });
  assert.deepEqual(await lookup.find('org_B'), { status: 'unavailable' });
});

test('Given no copy, when the first read fails or throws, then the gateway gets a failure', async () => {
  const store = new TenantRegistryStoreFake();
  store.readFailure = true;
  assert.deepEqual(await lookupOf(store).lookup.find('org_A'), { status: 'unavailable' });
  const throwing = new TenantLookup({ readRoutes: async () => { throw new Error('private storage details'); } }, () => 0);
  assert.deepEqual(await throwing.find('org_A'), { status: 'unavailable' });
});

test('Given a refresh that recovers after failures, when the gateway asks, then the new copy answers and its age starts again', async () => {
  const store = liveRegistry();
  const { lookup, clock } = lookupOf(store);
  await lookup.find('org_A');
  store.readFailure = true;
  clock.now = 50_000;
  await lookup.find('org_A');
  store.readFailure = false;
  store.rows.set('org_A', { state: 'deploying', internalUrl: address });
  clock.now = 55_000;
  assert.deepEqual(await lookup.find('org_A'), { status: 'found', state: 'deploying', internalUrl: address });
  store.readFailure = true;
  clock.now = 114_999;
  assert.deepEqual(await lookup.find('org_A'), { status: 'found', state: 'deploying', internalUrl: address });
  clock.now = 115_000;
  assert.deepEqual(await lookup.find('org_A'), { status: 'unavailable' });
});

test('Given asks at the same time after the bound, when the refresh is slow, then one store read serves them all and the copy age counts from its start', async () => {
  const store = liveRegistry();
  const { lookup, clock } = lookupOf(store);
  const gate = Promise.withResolvers<void>();
  store.readGate = gate.promise;
  const asks = [lookup.find('org_A'), lookup.find('org_A'), lookup.find('org_B')];
  clock.now = 3_000;
  gate.resolve();
  assert.deepEqual(await Promise.all(asks), [
    { status: 'found', state: 'live', internalUrl: address },
    { status: 'found', state: 'live', internalUrl: address },
    { status: 'absent' },
  ]);
  assert.equal(store.reads, 1);
  store.readGate = undefined;
  store.readFailure = true;
  clock.now = 60_999;
  assert.deepEqual(await lookup.find('org_A'), { status: 'found', state: 'live', internalUrl: address });
  clock.now = 61_000;
  assert.deepEqual(await lookup.find('org_A'), { status: 'unavailable' }, 'The copy read from 1 s is 60 s old at 61 s');
});

test('Given rows in several states, when signup asks for the row counts, then the copy gives the number of rows in each state, from the same read as the gateway', async () => {
  const store = liveRegistry();
  store.rows.set('org_B', { state: 'requested', internalUrl: null });
  store.rows.set('org_C', { state: 'requested', internalUrl: null });
  store.rows.set('org_D', { state: 'failed', internalUrl: null });
  const { lookup, clock } = lookupOf(store);
  assert.deepEqual(await lookup.find('org_A'), { status: 'found', state: 'live', internalUrl: address });

  const counted = await lookup.countByState();

  assert.deepEqual(counted, { status: 'counted', rowsByState: new Map([['live', 1], ['requested', 2], ['failed', 1]]) });
  assert.equal(store.reads, 1);
  store.rows.set('org_E', { state: 'deploying', internalUrl: null });
  clock.now = 11_000;
  assert.deepEqual(await lookup.countByState(), { status: 'counted', rowsByState: new Map([['live', 1], ['requested', 2], ['failed', 1], ['deploying', 1]]) });
  assert.equal(store.reads, 2);
});

test('Given an empty registry, a copy that is too old, or no copy, when signup asks for the row counts, then it gets no rows or a failure', async () => {
  const empty = new TenantRegistryStoreFake();
  assert.deepEqual(await lookupOf(empty).lookup.countByState(), { status: 'counted', rowsByState: new Map() });
  const store = liveRegistry();
  const { lookup, clock } = lookupOf(store);
  await lookup.countByState();
  store.readFailure = true;
  clock.now = 60_999;
  assert.deepEqual(await lookup.countByState(), { status: 'counted', rowsByState: new Map([['live', 1]]) });
  clock.now = 61_000;
  assert.deepEqual(await lookup.countByState(), { status: 'unavailable' });
  const failing = new TenantRegistryStoreFake();
  failing.readFailure = true;
  assert.deepEqual(await lookupOf(failing).lookup.countByState(), { status: 'unavailable' });
});
