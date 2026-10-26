import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OrganizationAdministration } from '../../../src/accounts/organizations/organization-administration.ts';
import type { OrganizationMember } from '../../../src/accounts/organizations/organization-directory.ts';
import { adminGrant, userGrant } from '../../support/fixtures/hosted-roles.ts';
import { actor, request, removalFixture } from './fixtures/membership-removal-fixtures.ts';

test('Given a current Admin without MFA proof, when an ordinary membership is removed, then only its exact ID is deleted after durable admission and completion is recorded', async () => {
  const fixture = removalFixture();
  const { directory, store, administration, records } = fixture;
  const original = directory.deleteMembership.bind(directory);
  directory.deleteMembership = async (id) => {
    assert.equal(store.operations.get(request.organizationId)?.outcome, null);
    assert.equal(store.admissions[0].membershipId, id);
    return original(id);
  };
  assert.equal(await administration.removeMember(actor, request), 'applied');
  assert.deepEqual(fixture.deletes, [request.membershipId]);
  assert.equal(store.operations.get(request.organizationId)?.outcome, 'applied');
  assert.equal(records.length, 1);
  assert.equal(records[0].action, 'remove-member');
  assert.equal(records[0].outcome, 'applied');
  assert.deepEqual(records[0].target, { membershipId: request.membershipId });
});

test('Given a User or foreign authority, when removal is requested, then it is denied before admission', async () => {
  for (const user of [{ ...actor.user, subject: 'user-c' }, { ...actor.user, authority: 'wrong-provider' }]) {
    const { administration, store, deletes } = removalFixture();
    assert.equal(await administration.removeMember({ user }, request), 'denied');
    assert.equal(store.admissions.length, 0);
    assert.deepEqual(deletes, []);
  }
});

test('Given unavailable removal storage, when removal is requested, then it is unavailable while organization access still works', async () => {
  const { options, directory } = removalFixture();
  const administration = new OrganizationAdministration({ ...options, removalStore: undefined });
  assert.equal(await administration.removeMember(actor, request), 'unavailable');
  assert.equal((await administration.listOrganizations(actor.user)).length, 1);
  assert.ok(directory.membershipIn('admin-b', 'org-a'));
});

test('Given authority that changes during durable admission, when current reads resume, then removal is denied and its own no-send intent is completed', async () => {
  const { administration, store, directory, deletes } = removalFixture();
  const admit = store.admitRemoval.bind(store);
  store.admitRemoval = async (intent) => {
    const result = await admit(intent);
    directory.configure(actor.user.subject, []);
    return result;
  };
  assert.equal(await administration.removeMember(actor, request), 'denied');
  assert.deepEqual(deletes, []);
  assert.equal(store.operations.get('org-a')?.outcome, 'no-effect');
});

const unsafeTargets: readonly [string, Partial<OrganizationMember>, string][] = [
  ['another organization', { organizationId: 'org-b' }, 'denied'],
  ['another membership ID', { membershipId: 'other-id' }, 'denied'],
  ['stale revision', { revision: 'r2' }, 'stale'],
  ['inactive status', { status: 'inactive' }, 'unsupported'],
  ['pending status', { status: 'pending' }, 'unsupported'],
  ['unknown role', { grants: [{ role: 'unknown-role', permissions: [] }] }, 'unsupported'],
  ['permissionless extra role', { grants: [adminGrant, { role: 'member', permissions: [] }] }, 'unsupported'],
  ['no roles', { grants: [] }, 'unsupported'],
  ['external management', { management: 'external' }, 'unsupported'],
  ['unknown management', { management: 'unknown' }, 'unsupported'],
];

for (const [label, change, expected] of unsafeTargets) {
  test(`Given an otherwise valid removal with only ${label}, when current target facts are checked, then no provider delete runs`, async () => {
    const { administration, directory, deletes, store } = removalFixture();
    const target = await directory.member(request.membershipId);
    assert.ok(target);
    directory.member = async () => ({ ...target, ...change });
    assert.equal(await administration.removeMember(actor, request), expected);
    assert.deepEqual(deletes, []);
    assert.equal(store.operations.get('org-a')?.outcome, 'no-effect');
  });
}

test('Given a target that disappeared, when removal is requested, then its stale form cannot delete another membership', async () => {
  const { administration, directory, deletes } = removalFixture();
  directory.member = async () => undefined;
  assert.equal(await administration.removeMember(actor, request), 'stale');
  assert.deepEqual(deletes, []);
});

test('Given one active Admin plus inactive and pending Admins and an invitation, when self-removal is requested, then the last Admin is retained', async () => {
  const { administration, directory, deletes } = removalFixture();
  directory.replaceMembers([
    { subject: actor.user.subject, organizationId: 'org-a', membershipId: 'member-a', grants: [adminGrant] },
    { subject: 'inactive', organizationId: 'org-a', grants: [adminGrant], status: 'inactive' },
    { subject: 'pending', organizationId: 'org-a', grants: [adminGrant], status: 'pending' },
  ]);
  directory.addInvitations({ organizationId: 'org-a', email: 'invite@example.com', role: 'admin' });
  assert.equal(await administration.removeMember(actor, { ...request, membershipId: 'member-a' }), 'last-admin');
  assert.deepEqual(deletes, []);
});

test('Given a second active Admin on a later page, when self-removal is requested, then all pages are read and removal is allowed', async () => {
  const { administration, directory } = removalFixture();
  directory.pageSize = 1;
  assert.equal(await administration.removeMember(actor, { ...request, membershipId: 'member-a' }), 'applied');
  assert.equal(directory.memberFactsPageReads.length, 3);
  assert.ok(directory.memberFactsPageReads.every(read => read.statuses.length === 1 && read.statuses[0] === 'active'));
});

test('Given a later page failure or a repeating cursor, when the full Admin count cannot be established, then removal refuses without a partial count', async () => {
  for (const failure of ['page', 'cursor']) {
    const { administration, directory, deletes } = removalFixture();
    if (failure === 'page') directory.memberFactsPageLayout = records => [[records[0]], new Error('Later page failed')];
    else {
      const page = await directory.memberFactsPage({ organizationId: 'org-a', statuses: ['active'] });
      directory.memberFactsPage = async () => ({ ...page, next: 'repeated' });
    }
    assert.equal(await administration.removeMember(actor, request), 'unavailable');
    assert.deepEqual(deletes, []);
  }
});

test('Given the last Admin duplicated across pages, when a newer record makes the other Admin inactive, then duplicates and stale active state do not permit self-removal', async () => {
  const { administration, directory, deletes } = removalFixture();
  directory.memberFactsPageLayout = records => [[records[0], records[1]], [records[0], { ...records[1], status: 'inactive' }]];
  assert.equal(await administration.removeMember(actor, { ...request, membershipId: 'member-a' }), 'last-admin');
  assert.deepEqual(deletes, []);
});

test('Given a target that changes from User to Admin between its direct read and the member pages, when removal finishes its checks, then the changed target is refused', async () => {
  const { administration, directory, deletes } = removalFixture();
  const target = await directory.member(request.membershipId);
  assert.ok(target);
  directory.member = async () => ({ ...target, grants: [userGrant] });
  assert.equal(await administration.removeMember(actor, request), 'stale');
  assert.deepEqual(deletes, []);
});

for (const pageCount of [10, 11]) {
  test(`Given ${pageCount} active-member pages, when a removal needs the complete count, then the fixed ten-page budget ${pageCount === 10 ? 'allows completion' : 'refuses without reading page eleven'}`, async () => {
    const { administration, directory, deletes, store } = removalFixture();
    directory.memberFactsPageLayout = records => [...Array.from({ length: pageCount - 1 }, () => []), records];
    assert.equal(await administration.removeMember(actor, request), pageCount === 10 ? 'applied' : 'unavailable');
    assert.equal(directory.memberFactsPageReads.length, 10);
    assert.equal(deletes.length, pageCount === 10 ? 1 : 0);
    assert.equal(store.operations.get('org-a')?.outcome, pageCount === 10 ? 'applied' : 'no-effect');
  });
}

for (const missingPermission of ['product:access', 'user-grants:manage', 'admin-grants:manage']) {
  test(`Given another Admin without ${missingPermission}, when the only usable Admin requests self-removal, then the unusable Admin does not prevent last-Admin refusal`, async () => {
    const { administration, directory, deletes } = removalFixture();
    directory.replaceMembers([
      { subject: actor.user.subject, organizationId: 'org-a', membershipId: 'member-a', grants: [adminGrant] },
      { subject: 'admin-b', organizationId: 'org-a', membershipId: 'member-b', grants: [{ ...adminGrant, permissions: adminGrant.permissions.filter(permission => permission !== missingPermission) }] },
    ]);
    assert.equal(await administration.removeMember(actor, { ...request, membershipId: 'member-a' }), 'last-admin');
    assert.deepEqual(deletes, []);
  });
}

test('Given the actor loses Admin permissions before the member pages return, when target facts stay unchanged, then the paged current actor still refuses removal', async () => {
  const { administration, directory, deletes } = removalFixture();
  directory.memberFactsPageLayout = records => [records.map(member => member.subject === actor.user.subject ? { ...member, grants: [userGrant] } : member)];
  assert.equal(await administration.removeMember(actor, request), 'denied');
  assert.deepEqual(deletes, []);
});

test('Given an Admin plus User target, when direct and page grant order differs but facts match, then supported combined grants can be removed', async () => {
  const { administration, directory, deletes } = removalFixture();
  directory.replaceMembers([
    { subject: actor.user.subject, organizationId: 'org-a', membershipId: 'member-a', grants: [adminGrant] },
    { subject: 'admin-b', organizationId: 'org-a', membershipId: 'member-b', grants: [adminGrant, userGrant] },
  ]);
  const member = directory.member.bind(directory);
  directory.member = async id => {
    const target = await member(id);
    return target === undefined ? target : { ...target, grants: [...target.grants].reverse() };
  };
  assert.equal(await administration.removeMember(actor, request), 'applied');
  assert.deepEqual(deletes, [request.membershipId]);
});

for (const difference of ['missing', 'membershipId', 'organizationId', 'revision', 'status', 'management', 'subject', 'roles', 'permissions'] as const) {
  test(`Given target ${difference} changes between direct and complete page reads, when a form uses its old facts, then removal is stale`, async () => {
    const { administration, directory, deletes } = removalFixture();
    directory.memberFactsPageLayout = records => [records.flatMap(member => {
      if (member.membershipId !== request.membershipId) return [member];
      if (difference === 'missing') return [];
      const changes = {
        membershipId: { membershipId: 'replacement-membership' }, organizationId: { organizationId: 'another-organization' },
        revision: { revision: 'r2' }, status: { status: 'inactive' as const }, management: { management: 'external' as const },
        subject: { subject: 'replacement-person' }, roles: { grants: [adminGrant, { role: 'unknown', permissions: [] }] },
        permissions: { grants: [{ ...adminGrant, permissions: ['product:access'] }] },
      };
      return [{ ...member, ...changes[difference] }];
    })];
    assert.equal(await administration.removeMember(actor, request), 'stale');
    assert.deepEqual(deletes, []);
  });
}

test('Given request and actor objects that the caller later mutates, when removal continues after an await, then the captured organization, actor, target, and revision decide it', async () => {
  const { administration, directory, store, deletes } = removalFixture();
  const submittedActor = { user: { ...actor.user } };
  const submittedRequest = { ...request };
  const memberships = directory.membershipsOf.bind(directory);
  directory.membershipsOf = async user => {
    submittedActor.user.subject = 'user-c';
    submittedRequest.organizationId = 'org-b';
    submittedRequest.membershipId = 'member-c';
    submittedRequest.revision = 'changed';
    return memberships(user);
  };
  assert.equal(await administration.removeMember(submittedActor, submittedRequest), 'applied');
  assert.deepEqual(deletes, [request.membershipId]);
  assert.equal(store.admissions[0].organizationId, 'org-a');
  assert.equal(store.admissions[0].actor.subject, actor.user.subject);
  assert.equal(store.admissions[0].revision, 'r1');
});

test('Given current safety facts and unavailable display pages, when removal runs, then the facts scan alone permits the exact deletion', async () => {
  const { administration, directory, deletes } = removalFixture();
  directory.memberPage = async () => { assert.fail('Removal must not load display pages'); };
  assert.equal(await administration.removeMember(actor, request), 'applied');
  assert.deepEqual(deletes, [request.membershipId]);
  assert.ok(directory.memberFactsPageReads.length > 0);
});
