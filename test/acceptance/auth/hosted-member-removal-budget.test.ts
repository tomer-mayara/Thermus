import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OrganizationAdministration } from '../../../src/accounts/organizations/organization-administration.ts';
import { WorkOSOrganizations, type WorkOSOrganizationsOptions } from '../../../src/accounts/providers/workos/workos-organizations.ts';
import { RemovalOperationStoreFake } from '../../support/doubles/organizations/removal-operation-store-fake.ts';
import { hostedRolePermissions } from '../../support/fixtures/hosted-roles.ts';

test('Given 100 active memberships and display-user reads that each cost 300 ms, when the current Admin removes an ordinary User, then only that target is deleted after admission and its exact operation has a terminal receipt within 30 seconds', async t => {
  let elapsed = 0;
  let measure = false;
  let userReads = 0;
  t.mock.method(performance, 'now', () => elapsed);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const memberships = Array.from({ length: 100 }, (_, index) => ({
    id: `member-${index}`, userId: `user-${index}`, organizationId: 'org-a',
    organizationName: 'A', status: 'active' as const, updatedAt: '2026-10-25T00:00:00Z',
    directoryManaged: false, roles: [{ slug: index === 0 ? 'admin' : 'user' }],
  }));
  const store = new RemovalOperationStoreFake();
  const deleted: string[] = [];
  const unused = async (): Promise<never> => { throw new Error('Unexpected provider operation'); };
  const options: WorkOSOrganizationsOptions = {
    authority: 'provider',
    memberships: {
      listOrganizationMemberships: async query => ({ data: query.userId ? [memberships[0]] : memberships, listMetadata: {} }),
      getOrganizationMembership: async id => {
        const member = memberships.find(each => each.id === id);
        assert.ok(member);
        return member;
      },
    },
    authorization: { listOrganizationRoles: async () => ({ data: Object.entries(hostedRolePermissions).map(([slug, permissions]) => ({ slug, permissions })) }) },
    userManagement: {
      getUser: async id => {
        if (measure) {
          userReads++;
          elapsed += 300;
          t.mock.timers.tick(300);
        }
        return { email: `${id}@example.com` };
      },
      deleteOrganizationMembership: async id => {
        const admitted = store.operations.get('org-a');
        assert.equal(admitted?.outcome, null);
        assert.equal(admitted?.membershipId, id);
        deleted.push(id);
        const index = memberships.findIndex(each => each.id === id);
        assert.ok(index >= 0);
        memberships.splice(index, 1);
      },
      listInvitations: unused, getInvitation: unused, sendInvitation: unused, resendInvitation: unused, revokeInvitation: unused,
    },
  };
  const directory = new WorkOSOrganizations(options);
  const target = await directory.member('member-1');
  assert.ok(target);
  const request = { organizationId: 'org-a', membershipId: 'member-1', revision: target.revision };
  const actor = { user: { authority: 'provider', subject: 'user-0' } };
  const administration = new OrganizationAdministration({ directory, removalStore: store, records: { record() {} }, billing: { stateOf: unused, updateSeats: unused } });
  t.after(() => administration.close());
  measure = true;

  const result = await administration.removeMember(actor, request);

  assert.equal(result, 'applied');
  assert.ok(elapsed < 30_000);
  assert.equal(userReads, 1, 'Only the existing direct-target read needs an email');
  assert.deepEqual(deleted, ['member-1']);
  assert.ok(memberships.some(each => each.id === 'member-0'), 'The acting Admin remains');
  assert.equal(store.admissions.length, 1);
  const [intent] = store.admissions;
  assert.deepEqual(await store.readRemoval('org-a'), { status: 'found', operation: { ...intent, outcome: 'applied' } });
  assert.equal(intent.membershipId, request.membershipId);
  assert.equal(intent.revision, request.revision);
  assert.deepEqual(intent.actor, actor.user);
});
