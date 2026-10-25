import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { MembershipStatus, OrganizationMemberFacts } from '../../../src/accounts/organizations/organization-directory.ts';
import { acme, globex, membership, roles, WorkOSOrganizationsDouble } from './fixtures/workos-organizations-double.ts';

const statuses: readonly MembershipStatus[] = ['active', 'inactive', 'pending'];

test('Given mixed member statuses, all roles and a cursor, when safety facts are paged, then the exact filtered page has all safety fields and no email or user read', async () => {
  const double = new WorkOSOrganizationsDouble();
  const records = statuses.map((status, index) => membership({ id: `member-${index}`, userId: `user-${index}`, status, roles: roles('user', 'admin', 'super-admin') }));
  double.membershipList = { data: records, after: 'next-members' };
  const directory = double.directory();

  const page = await directory.memberFactsPage({ organizationId: acme, statuses, cursor: 'previous-members' });

  assert.deepEqual(double.calls, [
    { method: 'listOrganizationMemberships', input: { organizationId: acme, statuses, limit: 100, after: 'previous-members' } },
    { method: 'listOrganizationRoles', input: acme },
  ]);
  assert.equal(page.next, 'next-members');
  assert.ok(Object.isFrozen(page) && Object.isFrozen(page.items));
  for (const [index, facts] of page.items.entries()) {
    const expected: OrganizationMemberFacts = {
      membershipId: `member-${index}`, subject: `user-${index}`, organizationId: acme, status: statuses[index], management: 'ordinary',
      grants: [
        { role: 'user', permissions: ['product:access'] },
        { role: 'admin', permissions: ['product:access', 'user-grants:manage', 'admin-grants:manage', 'billing:manage'] },
        { role: 'super-admin', permissions: [] },
      ],
      revision: facts.revision,
    };
    assert.deepEqual(facts, expected);
    assert.match(facts.revision, /^[A-Za-z0-9_-]{43}$/);
    assert.ok(Object.isFrozen(facts) && Object.isFrozen(facts.grants));
  }
});

for (const evidence of [false, true, undefined, null, 'false', 0, {}]) {
  test(`Given raw management ${JSON.stringify(evidence)}, when facts and the direct member are read, then every safety field and revision agrees without a paged user read`, async () => {
    const double = new WorkOSOrganizationsDouble();
    const record = membership({ directoryManaged: evidence, roles: roles('admin', 'user') });
    double.memberships.set(record.id, record);
    double.membershipList = { data: [record], after: null };
    double.emails.set(record.userId, 'current@example.com');
    const directory = double.directory();
    const direct = await directory.member(record.id);
    assert.ok(direct);
    const { email: _email, ...expected } = direct;
    double.calls.length = 0;

    const [facts] = (await directory.memberFactsPage({ organizationId: acme, statuses: ['active'] })).items;

    assert.deepEqual(facts, expected);
    assert.equal(facts?.management, evidence === false ? 'ordinary' : evidence === true ? 'external' : 'unknown');
    assert.deepEqual(double.methods(), ['listOrganizationMemberships', 'listOrganizationRoles']);
  });
}

test('Given unchanged membership roles in reverse order, when a later facts page uses the current catalog, then its revision stays equal and grants use the current application permissions', async () => {
  const double = new WorkOSOrganizationsDouble();
  const record = membership({ roles: roles('user', 'admin') });
  double.membershipList = { data: [record], after: null };
  const directory = double.directory();
  const [first] = (await directory.memberFactsPage({ organizationId: acme, statuses: ['active'] })).items;
  double.membershipList = { data: [{ ...record, roles: roles('admin', 'user') }], after: null };
  double.organizationRoles = double.organizationRoles.map(role => role.slug === 'admin' ? { ...role, permissions: [...role.permissions, 'provider:internal'] } : role);

  const [second] = (await directory.memberFactsPage({ organizationId: acme, statuses: ['active'] })).items;

  assert.ok(first !== undefined && second !== undefined);
  assert.equal(second.revision, first.revision);
  assert.deepEqual(second.grants, [...first.grants].reverse());
  assert.deepEqual(double.methods(), ['listOrganizationMemberships', 'listOrganizationRoles', 'listOrganizationMemberships', 'listOrganizationRoles']);
});

for (const after of [null, '']) {
  test(`Given an empty final facts page with cursor ${JSON.stringify(after)}, when it is read, then the page is frozen and no role or user read starts`, async () => {
    const double = new WorkOSOrganizationsDouble();
    double.membershipList = { data: [], after };
    const page = await double.directory().memberFactsPage({ organizationId: acme, statuses: ['pending'] });
    assert.deepEqual(page, { items: [] });
    assert.ok(Object.isFrozen(page) && Object.isFrozen(page.items));
    assert.deepEqual(double.calls, [{ method: 'listOrganizationMemberships', input: { organizationId: acme, statuses: ['pending'], limit: 100 } }]);
  });
}

for (const outsideScope of [membership({ organizationId: globex }), membership({ status: 'inactive' })]) {
  test(`Given an out-of-scope ${outsideScope.organizationId} ${outsideScope.status} record, when active facts are read, then the whole page fails before the role read`, async () => {
    const double = new WorkOSOrganizationsDouble();
    double.membershipList = { data: [membership(), outsideScope], after: null };
    await assert.rejects(double.directory().memberFactsPage({ organizationId: acme, statuses: ['active'] }), /did not ask for/);
    assert.deepEqual(double.methods(), ['listOrganizationMemberships']);
  });
}

test('Given no explicit statuses, when facts are read, then no provider request starts', async () => {
  const double = new WorkOSOrganizationsDouble();
  await assert.rejects(double.directory().memberFactsPage({ organizationId: acme, statuses: [] }), /status/);
  assert.deepEqual(double.calls, []);
});

for (const roleList of [undefined, roles('admin', 'unlisted')]) {
  test(`Given an unsafe role list ${JSON.stringify(roleList)}, when facts are read, then the page fails closed without user reads`, async () => {
    const double = new WorkOSOrganizationsDouble();
    double.membershipList = { data: [membership({ roles: roleList })], after: null };
    await assert.rejects(double.directory().memberFactsPage({ organizationId: acme, statuses: ['active'] }), /no role/);
    assert.equal(double.methods().includes('getUser'), false);
  });
}

for (const method of ['listOrganizationMemberships', 'listOrganizationRoles']) {
  test(`Given a failed ${method} read, when facts are read, then the original error reaches the caller instead of a partial page`, async () => {
    const double = new WorkOSOrganizationsDouble();
    double.membershipList = { data: [membership()], after: 'next' };
    const error = new Error('Read failed');
    double.failures.set(method, error);
    await assert.rejects(double.directory().memberFactsPage({ organizationId: acme, statuses: ['active'], cursor: 'later' }), caught => caught === error);
  });
}

test('Given a valid first facts page, when the current Admin catalog loses an application permission before a later read, then the later facts page fails closed', async () => {
  const double = new WorkOSOrganizationsDouble();
  double.membershipList = { data: [membership({ roles: roles('admin') })], after: 'later' };
  const directory = double.directory();
  await directory.memberFactsPage({ organizationId: acme, statuses: ['active'] });
  double.organizationRoles = double.organizationRoles.map(role => role.slug === 'admin' ? { ...role, permissions: ['product:access'] } : role);

  await assert.rejects(directory.memberFactsPage({ organizationId: acme, statuses: ['active'], cursor: 'later' }), /must give exactly/);

  assert.deepEqual(double.methods(), ['listOrganizationMemberships', 'listOrganizationRoles', 'listOrganizationMemberships', 'listOrganizationRoles']);
});
