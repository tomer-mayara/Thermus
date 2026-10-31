import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { WorkOSOrganizationInventory } from '../../../src/accounts/providers/workos/workos-organization-inventory.ts';
import { workosClientFor } from '../../support/doubles/workos/workos-fake-api.ts';
import { WorkOSFake, type FakeUser } from '../../support/doubles/workos/workos-fake.ts';

// The organization inventory of the sweeps over the pinned WorkOS SDK and the local WorkOS fake: the complete
// organization list, the read of one organization by its ID, and the active memberships that have only the default
// role, with the rule that a failed page never looks like a complete answer.

const organizations = ['org_01INVA', 'org_01INVB', 'org_01INVC'];
const signal = new AbortController().signal;
const ann: FakeUser = { id: 'user_01ANN', email: 'ann@example.com', firstName: 'Ann' };
const bob: FakeUser = { id: 'user_01BOB', email: 'bob@example.com', firstName: 'Bob' };

async function inventoryOf(t: TestContext) {
  const workos = await WorkOSFake.start(t, 'https://thermus.example/', organizations);
  workos.users = [ann, bob];
  return { workos, inventory: new WorkOSOrganizationInventory(workosClientFor(workos.fake)) };
}

function pathsOf(workos: WorkOSFake, prefix: string): string[] {
  return workos.fake.takeRequests().map((request) => request.path).filter((path) => path.startsWith(prefix));
}

test('Given organizations on several pages, when they are listed, then each page is read in order, and the list has every organization', async (t) => {
  const { workos, inventory } = await inventoryOf(t);
  workos.organizationPageSize = 1;

  assert.deepEqual(await inventory.listOrganizations(signal), { status: 'complete', organizationIds: new Set(organizations) });

  const reads = pathsOf(workos, '/organizations');
  assert.equal(reads.length, 3);
  assert.match(reads[0] ?? '', /^\/organizations\?limit=100&order=desc$/);
  assert.match(reads[1] ?? '', /[?&]after=org_01INVA(?:&|$)/);
  assert.match(reads[2] ?? '', /[?&]after=org_01INVB(?:&|$)/);
});

test('Given a removed organization, when they are listed, then the list leaves it out', async (t) => {
  const { workos, inventory } = await inventoryOf(t);
  workos.removedOrganizationIds.add('org_01INVB');
  assert.deepEqual(await inventory.listOrganizations(signal), { status: 'complete', organizationIds: new Set(['org_01INVA', 'org_01INVC']) });
});

test('Given a page that fails, a page that repeats its cursor, or no answer, when they are listed, then the list is unavailable, so it never looks complete', async (t) => {
  const failing = await inventoryOf(t);
  failing.workos.organizationPageSize = 1;
  failing.workos.laterOrganizationPageOutage = { status: 500, body: { message: 'Internal Server Error' } };
  const failed = await failing.inventory.listOrganizations(signal);
  assert.equal(failed.status, 'unavailable');
  assert.match(failed.status === 'unavailable' ? failed.reason : '', /^WorkOS answered 500/);

  const repeating = await inventoryOf(t);
  repeating.workos.fake.answer('GET /organizations', { status: 200, body: { object: 'list', data: [repeating.workos.organizationJson('org_01INVA')], list_metadata: { before: null, after: 'org_01INVA' } } });
  assert.deepEqual(await repeating.inventory.listOrganizations(signal), { status: 'unavailable', reason: 'WorkOS repeated the page cursor org_01INVA' });

  const closed = await inventoryOf(t);
  closed.workos.fake.answer('GET /organizations', 'close');
  assert.equal((await closed.inventory.listOrganizations(signal)).status, 'unavailable');
});

test('Given an organization that exists, a removed one, and a read that fails, when each is read by its ID, then the results are present, absent, and unavailable', async (t) => {
  const { workos, inventory } = await inventoryOf(t);
  workos.removedOrganizationIds.add('org_01INVB');
  workos.fake.answer('GET /organizations/org_01INVC', { status: 503, body: { message: 'Service Unavailable' } });

  assert.deepEqual(await inventory.readOrganization('org_01INVA', signal), { status: 'present' });
  assert.deepEqual(await inventory.readOrganization('org_01INVB', signal), { status: 'absent' });
  assert.deepEqual(await inventory.readOrganization('org_01INVC', signal), { status: 'unavailable', reason: 'WorkOS answered 503: Service Unavailable' });
});

test('Given an organization that the list leaves out while it still exists, when it is read by its ID, then it is present', async (t) => {
  const { workos, inventory } = await inventoryOf(t);
  workos.unlistedOrganizationIds.add('org_01INVB');
  assert.equal((await inventory.listOrganizations(signal)).status, 'complete');
  assert.deepEqual(await inventory.readOrganization('org_01INVB', signal), { status: 'present' });
});

test('Given active memberships with only the default role, with product roles, and inactive ones, when the default-role memberships are read, then each active one without a product role is listed with its organization', async (t) => {
  const { workos, inventory } = await inventoryOf(t);
  workos.membershipPageSize = 1;
  workos.memberships = [
    { userId: ann.id, organizationId: 'org_01INVA', roles: ['admin'] },
    { userId: bob.id, organizationId: 'org_01INVA', roles: [] },
    { userId: bob.id, organizationId: 'org_01INVB', roles: ['user'] },
    { userId: ann.id, organizationId: 'org_01INVB', roles: [], status: 'inactive' },
    { userId: ann.id, organizationId: 'org_01INVC', roles: ['member'] },
  ];

  assert.deepEqual(await inventory.defaultRoleMemberships(signal), {
    status: 'complete',
    memberships: [
      { organizationId: 'org_01INVA', membershipId: workos.membershipId(bob, 'org_01INVA') },
      { organizationId: 'org_01INVC', membershipId: workos.membershipId(ann, 'org_01INVC') },
    ],
  });
  const reads = pathsOf(workos, '/user_management/organization_memberships');
  assert.ok(reads.every((path) => /[?&]statuses=active(?:&|$)/.test(path)), 'Only active memberships are billed seats');
  assert.ok(reads.some((path) => /[?&]after=/.test(path)), 'The read follows the pages of one organization');
});

test('Given a membership page that fails, when the default-role memberships are read, then the result is unavailable, so it never looks like none', async (t) => {
  const { workos, inventory } = await inventoryOf(t);
  workos.membershipPageSize = 1;
  workos.memberships = [{ userId: ann.id, organizationId: 'org_01INVA', roles: ['admin'] }, { userId: bob.id, organizationId: 'org_01INVA', roles: [] }];
  workos.laterMembershipPageOutage = { status: 502, body: { message: 'Bad Gateway' } };

  const read = await inventory.defaultRoleMemberships(signal);
  assert.equal(read.status, 'unavailable');
  assert.match(read.status === 'unavailable' ? read.reason : '', /^WorkOS answered 502/);
});

test('Given a stopped caller, when the inventory reads, then each read rejects before it asks WorkOS', async (t) => {
  const { workos, inventory } = await inventoryOf(t);
  const stopped = new AbortController();
  stopped.abort();

  await assert.rejects(inventory.listOrganizations(stopped.signal));
  await assert.rejects(inventory.readOrganization('org_01INVA', stopped.signal));
  await assert.rejects(inventory.defaultRoleMemberships(stopped.signal));
  assert.deepEqual(workos.fake.takeRequests(), []);
});
