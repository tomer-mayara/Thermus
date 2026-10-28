import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mondayBeforeTheSweep, organizationA, organizationB, serviceNameOf, SweepHarness, tuesdayBeforeTheSweep } from './fixtures/sweep-harness.ts';

// SO-09 of the self on-boarding plan: the weekly organization sweep of the control plane deletes the tenant of each
// organization that WorkOS no longer has, and its row becomes deleted (plan section 4.2). The sweep runs as app composes
// the tenant sweeps from the control plane settings, against the WorkOS fake, the fake of the Render API, and a fake of
// the tenant registry, with a wall clock that gives one daily tick on a Monday at the sweep hour.

test('Given an organization that WorkOS no longer lists, when the sweep runs, then its Render service is deleted, and its row is deleted', async (t) => {
  const harness = await SweepHarness.start(t, [organizationA, organizationB]);
  harness.liveTenant(organizationA);
  const removed = harness.liveTenant(organizationB);
  harness.workos.removedOrganizationIds.add(organizationB);

  await harness.runOneTick(mondayBeforeTheSweep);

  assert.equal(harness.render.service(serviceNameOf(organizationB)), undefined, 'Render has no service of the removed organization');
  assert.deepEqual(harness.render.requestsOf('delete service').map((request) => request.path), [`/services/${removed.id}`]);
  assert.equal(harness.store.stateOf(organizationB), 'deleted');
  assert.equal(harness.store.row(organizationB).internalUrl, null, 'A deleted row has no route');
  assert.equal(harness.store.row(organizationB).serviceId, removed.id, 'The row keeps the ID of the deleted service for the record');
  assert.equal(harness.store.stateOf(organizationA), 'live');
  assert.ok(harness.render.service(serviceNameOf(organizationA)) !== undefined, 'The tenant of the listed organization stays');
  assert.deepEqual(harness.errorLines(), []);
});

test('Given organizations that WorkOS lists, when the sweep runs, then their tenants stay', async (t) => {
  const harness = await SweepHarness.start(t, [organizationA, organizationB]);
  harness.liveTenant(organizationA);
  harness.liveTenant(organizationB);

  await harness.runOneTick(mondayBeforeTheSweep);

  assert.deepEqual(harness.render.requestsOf('delete service'), []);
  assert.deepEqual([harness.store.stateOf(organizationA), harness.store.stateOf(organizationB)], ['live', 'live']);
  assert.equal(harness.render.services().length, 2);
  assert.deepEqual(harness.linesWith('Organization sweep:'), [
    `INFO Organization sweep: ${JSON.stringify({ rows: 2, organizations: 2, deleted: 0, foundOnRead: 0, unreadable: 0, inFlight: 0, moved: 0, failed: 0 })}`,
  ]);
});

test('Given a WorkOS list page that fails, when the sweep runs, then it deletes nothing, because a partial list must not look like a complete one', async (t) => {
  const harness = await SweepHarness.start(t, [organizationA, organizationB]);
  harness.liveTenant(organizationA);
  harness.liveTenant(organizationB);
  // Two pages: A on the first, B on the second, which fails. Without that page, B would look absent.
  harness.workos.organizationPageSize = 1;
  harness.workos.laterOrganizationPageOutage = { status: 500, body: { message: 'Internal Server Error' } };

  await harness.runOneTick(mondayBeforeTheSweep);

  assert.deepEqual(harness.render.requestsOf('delete service'), []);
  assert.deepEqual([harness.store.stateOf(organizationA), harness.store.stateOf(organizationB)], ['live', 'live']);
  const stops = harness.linesWith('Organization sweep stopped:');
  assert.equal(stops.length, 1);
  assert.match(stops[0] ?? '', /^ERROR Organization sweep stopped: \{"reason":"The organization list is not complete: .+"\}$/);
  assert.deepEqual(harness.linesWith('Organization sweep:'), [], 'No sweep line claims a comparison');
});

test('Given a deleted tenant, when the sweep ends, then the system log has one line for it', async (t) => {
  const harness = await SweepHarness.start(t, [organizationA, organizationB]);
  harness.liveTenant(organizationA);
  const removed = harness.liveTenant(organizationB);
  harness.workos.removedOrganizationIds.add(organizationB);

  await harness.runOneTick(mondayBeforeTheSweep);

  assert.deepEqual(harness.linesWith(organizationB), [
    `INFO Tenant removal record: ${JSON.stringify({ organizationId: organizationB, state: 'deleted', from: 'live', serviceId: removed.id, serviceName: removed.name, cause: 'organization-absent' })}`,
  ]);
  assert.deepEqual(harness.linesWith('Organization sweep:'), [
    `INFO Organization sweep: ${JSON.stringify({ rows: 2, organizations: 1, deleted: 1, foundOnRead: 0, unreadable: 0, inFlight: 0, moved: 0, failed: 0 })}`,
  ]);
});

test('Given an organization that the list leaves out while a read by its ID still finds it, when the sweep runs, then its tenant stays, because the lists lag behind a delete', async (t) => {
  const harness = await SweepHarness.start(t, [organizationA, organizationB]);
  harness.liveTenant(organizationA);
  harness.liveTenant(organizationB);
  harness.workos.unlistedOrganizationIds.add(organizationB);

  await harness.runOneTick(mondayBeforeTheSweep);

  assert.deepEqual(harness.render.requestsOf('delete service'), []);
  assert.equal(harness.store.stateOf(organizationB), 'live');
  const reads = harness.workos.fake.takeRequests().filter((request) => request.method === 'GET' && request.path === `/organizations/${organizationB}`);
  assert.equal(reads.length, 1, 'The sweep reads the left-out organization by its ID once');
  assert.deepEqual(harness.linesWith('Organization sweep:'), [
    `INFO Organization sweep: ${JSON.stringify({ rows: 2, organizations: 1, deleted: 0, foundOnRead: 1, unreadable: 0, inFlight: 0, moved: 0, failed: 0 })}`,
  ]);
});

test('Given a day that is not the sweep day, when the daily tick runs, then the organization sweep does not run, and the fleet summary does', async (t) => {
  const harness = await SweepHarness.start(t, [organizationA]);
  harness.liveTenant(organizationA);
  harness.liveTenant(organizationB);
  harness.workos.removedOrganizationIds.add(organizationB);

  await harness.runOneTick(tuesdayBeforeTheSweep);

  assert.deepEqual(harness.render.requestsOf('delete service'), []);
  assert.equal(harness.store.stateOf(organizationB), 'live');
  assert.deepEqual(harness.linesWith('Organization sweep'), []);
  assert.equal(harness.linesWith('Tenant fleet summary:').length, 1);
});
