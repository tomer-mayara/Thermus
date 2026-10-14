import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { MembershipStatus } from '../../../src/organizations/organization-directory.ts';
import {
  acme,
  assertConfigurationError,
  assertWorkOSFailure,
  globex,
  membership,
  notFound,
  refusal,
  roles,
  WorkOSOrganizationsDouble,
  type MembershipRecord,
} from './fixtures/workos-organizations-double.ts';

const alice = membership({ id: 'om_01ALICE', userId: 'user_01ALICE', roles: roles('user', 'admin') });
const bob = membership({ id: 'om_02BOB', userId: 'user_02BOB', status: 'inactive', roles: roles('admin') });
const carol = membership({ id: 'om_03CAROL', userId: 'user_03CAROL', status: 'pending', roles: roles('user') });
const everyStatus: readonly MembershipStatus[] = ['active', 'inactive', 'pending'];

// WorkOS with these memberships on one page, each also readable by its ID, and the users of Alice, Bob, and Carol.
function doubleWith(records: readonly MembershipRecord[], after: string | null = null): WorkOSOrganizationsDouble {
  const double = new WorkOSOrganizationsDouble();
  double.membershipList = { data: records, after };
  for (const record of records) double.memberships.set(record.id, record);
  double.emails.set('user_01ALICE', 'alice@example.com');
  double.emails.set('user_02BOB', 'bob@example.com');
  double.emails.set('user_03CAROL', 'carol@example.com');
  return double;
}

describe('WorkOSOrganizations member pages', () => {
  test('Given an active, an inactive, and a pending membership on a page with a next cursor, when the members are read with the three statuses and a cursor, then WorkOS gets one membership read with exactly these statuses, the limit 100, and the cursor, then one role read of the organization and one user read for each member in page order, and the frozen page has each member with its email, status, grants, and revision', async () => {
    const double = doubleWith([alice, bob, carol], 'om_03CAROL');

    const page = await double.directory().memberPage({ organizationId: acme, statuses: everyStatus, cursor: 'om_00START' });

    assert.deepEqual(double.calls, [
      { method: 'listOrganizationMemberships', input: { organizationId: acme, statuses: ['active', 'inactive', 'pending'], limit: 100, after: 'om_00START' } },
      { method: 'listOrganizationRoles', input: acme },
      { method: 'getUser', input: 'user_01ALICE' },
      { method: 'getUser', input: 'user_02BOB' },
      { method: 'getUser', input: 'user_03CAROL' },
    ]);
    assert.deepEqual(page.items.map(({ revision: _revision, ...member }) => member), [
      { membershipId: 'om_01ALICE', organizationId: acme, email: 'alice@example.com', status: 'active', grants: [{ role: 'user', permissions: ['product:access'] }, { role: 'admin', permissions: ['user-grants:manage'] }] },
      { membershipId: 'om_02BOB', organizationId: acme, email: 'bob@example.com', status: 'inactive', grants: [{ role: 'admin', permissions: ['user-grants:manage'] }] },
      { membershipId: 'om_03CAROL', organizationId: acme, email: 'carol@example.com', status: 'pending', grants: [{ role: 'user', permissions: ['product:access'] }] },
    ]);
    assert.equal(page.next, 'om_03CAROL');
    assert.ok(Object.isFrozen(page) && Object.isFrozen(page.items));
    assert.ok(page.items.every((member) => Object.isFrozen(member) && Object.isFrozen(member.grants)));
    assert.ok(page.items.every(({ revision }) => /^[A-Za-z0-9_-]{43}$/.test(revision)), 'Each revision is a SHA-256 digest in base64url.');
  });

  test('Given two members, when the members are read, then the user read of the second member starts only after the user read of the first member answered, so that a page makes one user read at a time', async () => {
    const double = doubleWith([alice, bob]);
    const read = double.userManagement.getUser;
    const started: string[] = [];
    let answerFirst: () => void = () => assert.fail('the first user read did not start');
    const firstAnswered = new Promise<void>((resolve) => { answerFirst = resolve; });
    double.userManagement.getUser = async (userId: string) => {
      started.push(userId);
      if (userId === 'user_01ALICE') await firstAnswered;
      return read(userId);
    };

    const reading = double.directory().memberPage({ organizationId: acme, statuses: everyStatus });
    await new Promise((resolve) => setImmediate(resolve));
    const startedBeforeAnswer = [...started];
    answerFirst();
    const page = await reading;

    assert.deepEqual(startedBeforeAnswer, ['user_01ALICE']);
    assert.deepEqual(started, ['user_01ALICE', 'user_02BOB']);
    assert.deepEqual(page.items.map(({ email }) => email), ['alice@example.com', 'bob@example.com']);
  });

  test('Given a membership with only the default role, when the members are read, then its one grant gives no permission, so that it authorizes nothing', async () => {
    const double = doubleWith([membership({ roles: roles('member') })]);

    const page = await double.directory().memberPage({ organizationId: acme, statuses: ['active'] });

    assert.deepEqual(page.items[0]?.grants, [{ role: 'member', permissions: [] }]);
  });

  for (const after of [null, '']) {
    test(`Given the last page, with the WorkOS cursor ${JSON.stringify(after)}, when the members are read, then the page has no next cursor`, async () => {
      const double = doubleWith([alice], after);

      const page = await double.directory().memberPage({ organizationId: acme, statuses: ['active'] });

      assert.equal(page.items.length, 1);
      assert.equal('next' in page, false);
    });
  }

  test('Given an empty page, when the pending members are read without a cursor, then the WorkOS read has no after cursor, WorkOS gets no role or user read, and the page is empty and frozen', async () => {
    const double = doubleWith([]);

    const page = await double.directory().memberPage({ organizationId: acme, statuses: ['pending'] });

    assert.deepEqual(page, { items: [] });
    assert.ok(Object.isFrozen(page) && Object.isFrozen(page.items));
    assert.deepEqual(double.calls, [{ method: 'listOrganizationMemberships', input: { organizationId: acme, statuses: ['pending'], limit: 100 } }]);
  });

  test('Given a read that names no status, when the members are read, then the read fails before any WorkOS call, because WorkOS would give only active memberships', async () => {
    const double = doubleWith([alice]);

    await assertWorkOSFailure(double.directory().memberPage({ organizationId: acme, statuses: [] }), /status/);
    assert.deepEqual(double.calls, []);
  });

  for (const { label, records, statuses } of [
    { label: 'a membership of another organization', records: [alice, membership({ id: 'om_04GLOBEX', organizationId: globex })], statuses: everyStatus },
    { label: 'an inactive membership to a read of active memberships', records: [alice, bob], statuses: ['active'] },
    { label: 'a pending membership to a read of active and inactive memberships', records: [carol], statuses: ['active', 'inactive'] },
  ] satisfies { label: string; records: MembershipRecord[]; statuses: readonly MembershipStatus[] }[]) {
    test(`Given WorkOS answers ${label}, when the members are read, then the read fails and gives no member, and WorkOS gets no role or user read`, async () => {
      const double = doubleWith(records);

      await assertWorkOSFailure(double.directory().memberPage({ organizationId: acme, statuses }), /did not ask for/);
      assert.deepEqual(double.methods(), ['listOrganizationMemberships']);
    });
  }

  test('Given a membership without a role list, when the members are read, then a HostedRoleConfigurationError names the organization and the rule, and no member is given', async () => {
    const double = doubleWith([alice, membership({ id: 'om_02BOB', userId: 'user_02BOB', roles: undefined })]);

    await assertConfigurationError(double.directory().memberPage({ organizationId: acme, statuses: ['active'] }), /no role list/, /multiple roles/, new RegExp(acme));
  });

  for (const method of ['listOrganizationMemberships', 'listOrganizationRoles', 'getUser']) {
    test(`Given a WorkOS read that fails (${method}), when the members are read, then the same error reaches the caller, so that a failure never looks like an organization without members`, async () => {
      const failure = refusal('server_error', 503);
      const double = doubleWith([alice, bob]);
      double.failures.set(method, failure);

      await assert.rejects(double.directory().memberPage({ organizationId: acme, statuses: everyStatus }), (error) => error === failure);
    });
  }
});

describe('WorkOSOrganizations member', () => {
  test('Given a membership in Globex, when it is read by its ID, then it is the frozen member with its email, grants, and revision, after one membership read, one role read of Globex, and one user read; the directory reads any organization, because the service checks the organization', async () => {
    const double = doubleWith([membership({ id: 'om_05GLOBEX', organizationId: globex, organizationName: 'Globex', roles: roles('super-admin') })]);

    const member = await double.directory().member('om_05GLOBEX');

    assert.ok(member !== undefined);
    const { revision, ...rest } = member;
    assert.deepEqual(rest, { membershipId: 'om_05GLOBEX', organizationId: globex, email: 'alice@example.com', status: 'active', grants: [{ role: 'super-admin', permissions: ['admin-grants:manage', 'billing:manage'] }] });
    assert.match(revision, /^[A-Za-z0-9_-]{43}$/);
    assert.ok(Object.isFrozen(member) && Object.isFrozen(member.grants));
    assert.deepEqual(double.calls, [
      { method: 'getOrganizationMembership', input: 'om_05GLOBEX' },
      { method: 'listOrganizationRoles', input: globex },
      { method: 'getUser', input: 'user_01ALICE' },
    ]);
  });

  test('Given WorkOS answers 404 for the membership, when it is read by its ID, then the member is undefined, and WorkOS gets no role or user read', async () => {
    const double = doubleWith([]);

    assert.equal(await double.directory().member('om_09GONE'), undefined);
    assert.deepEqual(double.calls, [{ method: 'getOrganizationMembership', input: 'om_09GONE' }]);
  });

  test('Given WorkOS answers a membership with another ID, when a member is read, then the read fails and gives no member', async () => {
    const double = doubleWith([]);
    double.memberships.set('om_01ALICE', membership({ id: 'om_02OTHER' }));

    await assertWorkOSFailure(double.directory().member('om_01ALICE'), /did not ask for/);
    assert.deepEqual(double.methods(), ['getOrganizationMembership']);
  });

  test('Given a membership without a role list, when it is read by its ID, then a HostedRoleConfigurationError names the organization and the rule', async () => {
    const double = doubleWith([membership({ roles: undefined })]);

    await assertConfigurationError(double.directory().member('om_01ALICE'), /no role list/, new RegExp(acme));
  });

  for (const { label, method, failure } of [
    { label: 'a membership read that fails with 500', method: 'getOrganizationMembership', failure: refusal('server_error', 500) },
    { label: 'a membership read that fails with 400', method: 'getOrganizationMembership', failure: refusal('invalid_request', 400) },
    { label: 'a membership read that gets no answer', method: 'getOrganizationMembership', failure: new Error('fetch failed') },
    { label: 'a role read that fails with 503', method: 'listOrganizationRoles', failure: refusal('server_error', 503) },
    { label: 'a user read that fails with 404', method: 'getUser', failure: notFound() },
  ]) {
    test(`Given ${label}, when a member is read, then the same error reaches the caller, because only a 404 of the membership means no member`, async () => {
      const double = doubleWith([alice]);
      double.failures.set(method, failure);

      await assert.rejects(double.directory().member('om_01ALICE'), (error) => error === failure);
    });
  }
});

describe('WorkOSOrganizations member revision', () => {
  test('Given one state of a membership, when it is read by its ID, on a page, and again with its roles in another order, then each read gives the same revision', async () => {
    const double = doubleWith([alice]);
    const directory = double.directory();

    const single = await directory.member('om_01ALICE');
    const [paged] = (await directory.memberPage({ organizationId: acme, statuses: ['active'] })).items;
    double.memberships.set('om_01ALICE', { ...alice, roles: roles('admin', 'user') });
    const reordered = await directory.member('om_01ALICE');

    assert.ok(single !== undefined && paged !== undefined && reordered !== undefined);
    assert.equal(paged.revision, single.revision);
    assert.equal(reordered.revision, single.revision);
  });

  for (const { label, changes } of [
    { label: 'a later update time', changes: { updatedAt: '2026-10-14T08:00:01.000Z' } },
    { label: 'another status with the same update time', changes: { status: 'inactive' } },
    { label: 'one role less with the same update time', changes: { roles: roles('user') } },
    { label: 'one more role with the same update time', changes: { roles: roles('user', 'admin', 'super-admin') } },
  ] satisfies { label: string; changes: Partial<MembershipRecord> }[]) {
    test(`Given a membership that changes to ${label}, when it is read again, then its revision changes`, async () => {
      const double = doubleWith([alice]);
      const directory = double.directory();
      const before = await directory.member('om_01ALICE');

      double.memberships.set('om_01ALICE', { ...alice, ...changes });
      const after = await directory.member('om_01ALICE');

      assert.ok(before !== undefined && after !== undefined);
      assert.notEqual(after.revision, before.revision);
    });
  }
});
