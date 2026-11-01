import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TenantLookup, type TenantLookupResult } from '../../../src/tenancy/tenants/tenant-lookup.ts';
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

// The cases of the copy bounds compare the state and the address; the cases of the change time compare the time.
async function routeOf(asked: Promise<TenantLookupResult>): Promise<unknown> {
  const result = await asked;
  return result.status === 'found' ? { status: result.status, state: result.state, internalUrl: result.internalUrl } : result;
}

async function sinceChangeOf(asked: Promise<TenantLookupResult>): Promise<number | undefined> {
  const result = await asked;
  return result.status === 'found' ? result.sinceChangeMs : undefined;
}

test('Given a row that changed 30 s before a slow read, when the gateway asks inside the bound of the copy, then it gets the time since the change, counted from the start of the read so that it never understates', async () => {
  const store = new TenantRegistryStoreFake();
  store.rows.set('org_A', { state: 'live', internalUrl: address, sinceChangeMs: 30_000 });
  const { lookup, clock } = lookupOf(store);
  const gate = Promise.withResolvers<void>();
  store.readGate = gate.promise;

  const first = sinceChangeOf(lookup.find('org_A'));
  clock.now = 1_500;
  gate.resolve();

  assert.equal(await first, 30_500);
  clock.now = 10_999;
  assert.equal(await sinceChangeOf(lookup.find('org_A')), 39_999);
  assert.equal(store.reads, 1);
});

test('Given a row that changed again, when the copy refreshes at the bound of 10 s, then the gateway gets the time since the new change', async () => {
  const store = new TenantRegistryStoreFake();
  store.rows.set('org_A', { state: 'live', internalUrl: address, sinceChangeMs: 600_000 });
  const { lookup, clock } = lookupOf(store);
  assert.equal(await sinceChangeOf(lookup.find('org_A')), 600_000);
  store.rows.set('org_A', { state: 'live', internalUrl: address, sinceChangeMs: 2_000 });

  clock.now = 11_000;

  assert.equal(await sinceChangeOf(lookup.find('org_A')), 2_000);
  assert.equal(store.reads, 2);
});

test('Given a registry row and a registry without a row, when the gateway asks, then it gets the state and the internal address, or the absence', async () => {
  const { lookup } = lookupOf(liveRegistry());
  assert.deepEqual(await routeOf(lookup.find('org_A')), { status: 'found', state: 'live', internalUrl: address });
  assert.deepEqual(await routeOf(lookup.find('org_B')), { status: 'absent' });
});

test('Given a read inside the bound of 10 s, when the gateway asks again, then the copy answers without a store read', async () => {
  const store = liveRegistry();
  const { lookup, clock } = lookupOf(store);
  await lookup.find('org_A');
  store.rows.set('org_A', { state: 'suspended', internalUrl: address });
  clock.now = 10_999;
  assert.deepEqual(await routeOf(lookup.find('org_A')), { status: 'found', state: 'live', internalUrl: address });
  assert.deepEqual(await routeOf(lookup.find('org_B')), { status: 'absent' });
  assert.equal(store.reads, 1);
});

test('Given a read at the bound of 10 s, when the gateway asks, then the lookup refreshes the copy and gives the new state', async () => {
  const store = liveRegistry();
  const { lookup, clock } = lookupOf(store);
  await lookup.find('org_A');
  store.rows.set('org_A', { state: 'suspended', internalUrl: address });
  store.rows.set('org_B', { state: 'requested', internalUrl: null });
  clock.now = 11_000;
  assert.deepEqual(await routeOf(lookup.find('org_A')), { status: 'found', state: 'suspended', internalUrl: address });
  assert.deepEqual(await routeOf(lookup.find('org_B')), { status: 'found', state: 'requested', internalUrl: null });
  assert.equal(store.reads, 2);
});

test('Given a failed refresh, when the copy is younger than 60 s, then the stale copy answers, and from 60 s the gateway gets a failure', async () => {
  const store = liveRegistry();
  const { lookup, clock } = lookupOf(store);
  await lookup.find('org_A');
  store.readFailure = true;
  for (const now of [11_000, 40_000, 60_999]) {
    clock.now = now;
    assert.deepEqual(await routeOf(lookup.find('org_A')), { status: 'found', state: 'live', internalUrl: address });
  }
  assert.equal(store.reads, 4, 'Each ask after the bound tries a refresh');
  clock.now = 61_000;
  assert.deepEqual(await routeOf(lookup.find('org_A')), { status: 'unavailable' });
  assert.deepEqual(await routeOf(lookup.find('org_B')), { status: 'unavailable' });
});

test('Given no copy, when the first read fails or throws, then the gateway gets a failure', async () => {
  const store = new TenantRegistryStoreFake();
  store.readFailure = true;
  assert.deepEqual(await routeOf(lookupOf(store).lookup.find('org_A')), { status: 'unavailable' });
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
  assert.deepEqual(await routeOf(lookup.find('org_A')), { status: 'found', state: 'deploying', internalUrl: address });
  store.readFailure = true;
  clock.now = 114_999;
  assert.deepEqual(await routeOf(lookup.find('org_A')), { status: 'found', state: 'deploying', internalUrl: address });
  clock.now = 115_000;
  assert.deepEqual(await routeOf(lookup.find('org_A')), { status: 'unavailable' });
});

test('Given asks at the same time after the bound, when the refresh is slow, then one store read serves them all and the copy age counts from its start', async () => {
  const store = liveRegistry();
  const { lookup, clock } = lookupOf(store);
  const gate = Promise.withResolvers<void>();
  store.readGate = gate.promise;
  const asks = [lookup.find('org_A'), lookup.find('org_A'), lookup.find('org_B')];
  clock.now = 3_000;
  gate.resolve();
  assert.deepEqual(await Promise.all(asks.map(routeOf)), [
    { status: 'found', state: 'live', internalUrl: address },
    { status: 'found', state: 'live', internalUrl: address },
    { status: 'absent' },
  ]);
  assert.equal(store.reads, 1);
  store.readGate = undefined;
  store.readFailure = true;
  clock.now = 60_999;
  assert.deepEqual(await routeOf(lookup.find('org_A')), { status: 'found', state: 'live', internalUrl: address });
  clock.now = 61_000;
  assert.deepEqual(await routeOf(lookup.find('org_A')), { status: 'unavailable' }, 'The copy read from 1 s is 60 s old at 61 s');
});

test('Given rows in several states, when signup asks for the row counts, then the copy gives the number of rows in each state, from the same read as the gateway', async () => {
  const store = liveRegistry();
  store.rows.set('org_B', { state: 'requested', internalUrl: null });
  store.rows.set('org_C', { state: 'requested', internalUrl: null });
  store.rows.set('org_D', { state: 'failed', internalUrl: null });
  const { lookup, clock } = lookupOf(store);
  assert.deepEqual(await routeOf(lookup.find('org_A')), { status: 'found', state: 'live', internalUrl: address });

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
