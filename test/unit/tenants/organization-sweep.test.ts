import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OrganizationSweep } from '../../../src/tenancy/tenants/organization-sweep.ts';
import type { TenantState } from '../../../src/tenancy/tenants/tenant-registry-store.ts';
import { OperatorLogSpy } from '../../support/doubles/application/operator-log-spy.ts';
import { TenantFleetStoreFake } from '../../support/doubles/tenants/tenant-fleet-store-fake.ts';
import { OrganizationInventoryFake } from './fixtures/organization-inventory-fake.ts';
import { TenantPlatformFake } from './fixtures/tenant-platform-fake.ts';

// The weekly organization sweep with a fake of the organization inventory, a fake of the tenant platform, the registry
// fake, and a spy of the operator log: it compares the rows that are not deleted with a complete organization list,
// reads each left-out organization by its ID, and removes a tenant only when that read says that it is absent.

const signal = new AbortController().signal;
const monday = Date.parse('2026-11-02T04:00:00Z');
// An organization that the list has and no row names, so that the list is not empty while the rows are absent from it.
const listed = ['org_Z'];

function sweepOf(rows: Readonly<Record<string, TenantState>>, organizations: readonly string[]) {
  const store = new TenantFleetStoreFake();
  for (const [organizationId, state] of Object.entries(rows)) {
    const serviceId = state === 'requested' ? null : `srv-${organizationId.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    store.put({ organizationId, state, serviceId, serviceName: `thermus-tenant-${organizationId.toLowerCase()}`, internalUrl: serviceId === null ? null : 'http://thermus-tenant-x:8080' });
  }
  const inventory = new OrganizationInventoryFake(organizations);
  const platform = new TenantPlatformFake();
  const log = new OperatorLogSpy();
  return { store, inventory, platform, log, sweep: new OrganizationSweep({ store, inventory, platform, log }) };
}

function tally(counts: Partial<Record<'rows' | 'organizations' | 'deleted' | 'foundOnRead' | 'unreadable' | 'inFlight' | 'moved' | 'failed', number>>): string {
  return `INFO Organization sweep: ${JSON.stringify({ rows: 0, organizations: 0, deleted: 0, foundOnRead: 0, unreadable: 0, inFlight: 0, moved: 0, failed: 0, ...counts })}`;
}

test('Given rows and a complete organization list, when the sweep runs, then only the tenant of an organization that is absent on its read by ID is removed', async () => {
  const { store, inventory, platform, log, sweep } = sweepOf({ org_A: 'live', org_B: 'suspended', org_C: 'failed' }, ['org_A']);

  await sweep.run(monday, signal);

  assert.deepEqual(inventory.calls, ['list', 'read org_B', 'read org_C']);
  assert.deepEqual(platform.calls, ['delete srv-orgb', 'delete srv-orgc']);
  assert.deepEqual([store.stateOf('org_A'), store.stateOf('org_B'), store.stateOf('org_C')], ['live', 'deleted', 'deleted']);
  assert.deepEqual(log.lines, [
    `INFO Tenant removal record: ${JSON.stringify({ organizationId: 'org_B', state: 'deleted', from: 'suspended', serviceId: 'srv-orgb', serviceName: 'thermus-tenant-org_b', cause: 'organization-absent' })}`,
    `INFO Tenant removal record: ${JSON.stringify({ organizationId: 'org_C', state: 'deleted', from: 'failed', serviceId: 'srv-orgc', serviceName: 'thermus-tenant-org_c', cause: 'organization-absent' })}`,
    tally({ rows: 3, organizations: 1, deleted: 2 }),
  ]);
});

test('Given an organization list that is not complete, when the sweep runs, then it reads no organization, deletes nothing, and reports one stop', async () => {
  const { store, inventory, platform, log, sweep } = sweepOf({ org_A: 'live', org_B: 'live' }, ['org_A']);
  inventory.listFailure = 'WorkOS answered 500: Internal Server Error';

  await sweep.run(monday, signal);

  assert.deepEqual(inventory.calls, ['list']);
  assert.deepEqual(platform.calls, []);
  assert.deepEqual([store.stateOf('org_A'), store.stateOf('org_B')], ['live', 'live']);
  assert.deepEqual(log.lines, [`ERROR Organization sweep stopped: ${JSON.stringify({ reason: 'The organization list is not complete: WorkOS answered 500: Internal Server Error' })}`]);
});

test('Given a registry that cannot be read, when the sweep runs, then it asks WorkOS nothing and reports one stop', async () => {
  const { store, inventory, platform, log, sweep } = sweepOf({ org_A: 'live' }, []);
  store.fleetUnavailable.add('read');

  await sweep.run(monday, signal);

  assert.deepEqual(inventory.calls, []);
  assert.deepEqual(platform.calls, []);
  assert.deepEqual(log.lines, [`ERROR Organization sweep stopped: ${JSON.stringify({ reason: 'The tenant registry cannot be read' })}`]);
});

test('Given a deleted row of an absent organization, when the sweep runs, then the row is not read or deleted again', async () => {
  const { store, inventory, platform, log, sweep } = sweepOf({ org_A: 'deleted' }, listed);

  await sweep.run(monday, signal);

  assert.deepEqual(inventory.calls, ['list']);
  assert.deepEqual(platform.calls, []);
  assert.deepEqual(store.changes, []);
  assert.deepEqual(log.lines, [tally({ organizations: 1 })]);
});

test('Given a left-out organization that its read by ID still finds, when the sweep runs, then its tenant stays', async () => {
  const { store, inventory, platform, log, sweep } = sweepOf({ org_A: 'live' }, ['org_A', ...listed]);
  inventory.unlisted.add('org_A');

  await sweep.run(monday, signal);

  assert.deepEqual(platform.calls, []);
  assert.equal(store.stateOf('org_A'), 'live');
  assert.deepEqual(log.lines, [tally({ rows: 1, organizations: 1, foundOnRead: 1 })]);
});

test('Given a left-out organization whose read by ID fails, when the sweep runs, then its tenant stays, and the line names the next sweep', async () => {
  const { store, inventory, platform, log, sweep } = sweepOf({ org_A: 'live' }, listed);
  inventory.readFailures.set('org_A', 'WorkOS answered 503: Service Unavailable');

  await sweep.run(monday, signal);

  assert.deepEqual(platform.calls, []);
  assert.equal(store.stateOf('org_A'), 'live');
  assert.deepEqual(log.lines, [
    'INFO The organization sweep keeps the tenant of organization org_A: its read by ID is unavailable (WorkOS answered 503: Service Unavailable). The next sweep reads it again.',
    tally({ rows: 1, organizations: 1, unreadable: 1 }),
  ]);
});

test('Given rows that the provisioner works on, when their organization is absent, then they wait for the next sweep and are not read', async () => {
  const { store, inventory, platform, log, sweep } = sweepOf({ org_A: 'creating', org_B: 'deploying' }, listed);

  await sweep.run(monday, signal);

  assert.deepEqual(inventory.calls, ['list']);
  assert.deepEqual(platform.calls, []);
  assert.deepEqual([store.stateOf('org_A'), store.stateOf('org_B')], ['creating', 'deploying']);
  assert.deepEqual(log.lines, [tally({ rows: 2, organizations: 1, inFlight: 2 })]);
});

test('Given a requested row of an absent organization, when the sweep runs, then the row is deleted without a platform call', async () => {
  const { store, platform, sweep } = sweepOf({ org_A: 'requested' }, listed);
  await sweep.run(monday, signal);
  assert.deepEqual(platform.calls, []);
  assert.equal(store.stateOf('org_A'), 'deleted');
});

test('Given a removal that fails, when the sweep runs, then it reports the failure and goes on with the next row', async () => {
  const { store, platform, log, sweep } = sweepOf({ org_A: 'live', org_B: 'live' }, listed);
  platform.deletions.push({ status: 'unavailable', reason: 'Render answered 503' });

  await sweep.run(monday, signal);

  assert.deepEqual([store.stateOf('org_A'), store.stateOf('org_B')], ['live', 'deleted']);
  assert.equal(log.lines[0], `ERROR Tenant removal failed: ${JSON.stringify({ organizationId: 'org_A', serviceId: 'srv-orga', reason: 'The platform did not delete the tenant service srv-orga: Render answered 503' })}`);
  assert.equal(log.lines.at(-1), tally({ rows: 2, organizations: 1, deleted: 1, failed: 1 }));
});

test('Given a row that another writer moves during its removal, when the sweep runs, then the row is left for the next sweep', async () => {
  const { store, log, sweep } = sweepOf({ org_A: 'live' }, listed);
  store.beforeChange = () => { store.row('org_A').state = 'suspended'; };

  await sweep.run(monday, signal);

  assert.equal(store.stateOf('org_A'), 'suspended');
  assert.deepEqual(log.lines, [
    'INFO The organization sweep leaves organization org_A: its row changed during the removal. The next sweep removes it.',
    tally({ rows: 1, organizations: 1, moved: 1 }),
  ]);
});

// The bound of the deletion authority (manager decision of 28 October 2026): an empty list, or more than two rows that
// are not deleted and are absent from the list, stops the sweep before any read by ID, delete, or row change.

function stop(reason: string, counts: { readonly rows: number; readonly organizations: number; readonly absent: number }): string {
  return `ERROR Organization sweep stopped: ${JSON.stringify({ reason, ...counts })}`;
}

test('Given more than two absent organizations, when the sweep runs, then it reads none by its ID, deletes nothing, and reports one stop with the counts', async () => {
  const { store, inventory, platform, log, sweep } = sweepOf({ org_A: 'live', org_B: 'live', org_C: 'suspended', org_D: 'failed' }, ['org_A']);

  await sweep.run(monday, signal);

  assert.deepEqual(inventory.calls, ['list']);
  assert.deepEqual(platform.calls, []);
  assert.deepEqual(store.changes, []);
  assert.deepEqual(log.lines, [stop('More than 2 tenants have no organization in the list', { rows: 4, organizations: 1, absent: 3 })]);
});

test('Given two absent organizations, when the sweep runs, then both tenants are removed, because two are inside the bound', async () => {
  const { store, platform, log, sweep } = sweepOf({ org_A: 'live', org_B: 'live', org_C: 'live' }, ['org_A']);

  await sweep.run(monday, signal);

  assert.deepEqual(platform.calls, ['delete srv-orgb', 'delete srv-orgc']);
  assert.deepEqual([store.stateOf('org_B'), store.stateOf('org_C')], ['deleted', 'deleted']);
  assert.equal(log.lines.at(-1), tally({ rows: 3, organizations: 1, deleted: 2 }));
});

test('Given absent rows that the provisioner works on, when they make more than two absent rows, then they count toward the bound, and the sweep stops', async () => {
  const { store, inventory, platform, log, sweep } = sweepOf({ org_A: 'creating', org_B: 'deploying', org_C: 'live' }, listed);

  await sweep.run(monday, signal);

  assert.deepEqual(inventory.calls, ['list']);
  assert.deepEqual(platform.calls, []);
  assert.equal(store.stateOf('org_C'), 'live');
  assert.deepEqual(log.lines, [stop('More than 2 tenants have no organization in the list', { rows: 3, organizations: 1, absent: 3 })]);
});

test('Given an empty organization list, when the sweep runs, then it reads no organization by its ID, deletes nothing, and reports one stop with the counts', async () => {
  const { store, inventory, platform, log, sweep } = sweepOf({ org_A: 'live', org_B: 'deleted' }, []);

  await sweep.run(monday, signal);

  assert.deepEqual(inventory.calls, ['list']);
  assert.deepEqual(platform.calls, []);
  assert.deepEqual(store.changes, []);
  assert.deepEqual(log.lines, [stop('The organization list is empty', { rows: 1, organizations: 0, absent: 1 })]);
});

test('Given an empty organization list and no tenant, when the sweep runs, then it still reports one stop, because the list of a wrong key looks empty', async () => {
  const { log, sweep } = sweepOf({}, []);

  await sweep.run(monday, signal);

  assert.deepEqual(log.lines, [stop('The organization list is empty', { rows: 0, organizations: 0, absent: 0 })]);
});

test('Given the daily ticks of a week, when the sweep is asked whether it runs, then it runs only on the Monday tick', () => {
  const { sweep } = sweepOf({}, []);
  const days = Array.from({ length: 7 }, (_day, index) => monday + index * 86_400_000);
  assert.deepEqual(days.map((tick) => sweep.runsAt(tick)), [true, false, false, false, false, false, false]);
  assert.equal(sweep.name, 'organization sweep');
});
