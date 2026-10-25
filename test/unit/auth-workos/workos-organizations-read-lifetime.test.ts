import assert from 'node:assert/strict';
import test from 'node:test';
import { acme, globex, membership, roles, WorkOSOrganizationsDouble } from './fixtures/workos-organizations-double.ts';

const user = { authority: 'workos:client_test', subject: 'user_01ALICE' };

for (const operation of ['memberships', 'member', 'page'] as const) {
  test(`Given an aborted ${operation} read, when the directory is called, then it sends no provider request`, async () => {
    const double = new WorkOSOrganizationsDouble();
    const directory = double.directory();
    const controller = new AbortController();
    const reason = new Error('The owner stopped');
    controller.abort(reason);
    const reading = operation === 'memberships' ? directory.membershipsOf(user, controller.signal)
      : operation === 'member' ? directory.member('member-a', controller.signal)
        : directory.memberPage({ organizationId: acme, statuses: ['active'], signal: controller.signal });
    await assert.rejects(reading, error => error === reason);
    assert.deepEqual(double.calls, []);
  });
}

for (const stopAt of ['first-page', 'last-page', 'first-roles'] as const) {
  test(`Given actor memberships in two organizations, when the signal aborts after ${stopAt}, then no next page or role read starts`, async () => {
    const double = new WorkOSOrganizationsDouble();
    const controller = new AbortController();
    const reason = new Error('The owner stopped');
    let lists = 0;
    let roleReads = 0;
    double.userManagement.listOrganizationMemberships = async () => {
      lists++;
      if ((stopAt === 'first-page' && lists === 1) || (stopAt === 'last-page' && lists === 2)) controller.abort(reason);
      return { object: 'list' as const, data: [membership({ organizationId: lists === 1 ? acme : globex })], listMetadata: { before: null, after: lists === 1 ? 'next' : null } };
    };
    const readRoles = double.authorization.listOrganizationRoles;
    double.authorization.listOrganizationRoles = async id => {
      roleReads++;
      const result = await readRoles(id);
      if (stopAt === 'first-roles') controller.abort(reason);
      return result;
    };
    await assert.rejects(double.directory().membershipsOf(user, controller.signal), error => error === reason);
    assert.equal(lists, stopAt === 'first-page' ? 1 : 2);
    assert.equal(roleReads, stopAt === 'first-roles' ? 1 : 0);
  });
}

for (const stopAt of ['membership', 'roles', 'user'] as const) {
  test(`Given a direct target read, when the signal aborts during ${stopAt}, then its response is rejected and no further enrichment starts`, async () => {
    const double = new WorkOSOrganizationsDouble();
    const record = membership();
    double.memberships.set(record.id, record);
    double.emails.set(record.userId, 'member@example.com');
    const controller = new AbortController();
    const reason = new Error('The owner stopped');
    const readMember = double.userManagement.getOrganizationMembership;
    double.userManagement.getOrganizationMembership = async id => {
      const result = await readMember(id);
      if (stopAt === 'membership') controller.abort(reason);
      return result;
    };
    const readRoles = double.authorization.listOrganizationRoles;
    double.authorization.listOrganizationRoles = async id => {
      const result = await readRoles(id);
      if (stopAt === 'roles') controller.abort(reason);
      return result;
    };
    const readUser = double.userManagement.getUser;
    double.userManagement.getUser = async id => {
      const result = await readUser(id);
      if (stopAt === 'user') controller.abort(reason);
      return result;
    };
    await assert.rejects(double.directory().member(record.id, controller.signal), error => error === reason);
    assert.deepEqual(double.methods(), ['getOrganizationMembership', ...(stopAt === 'membership' ? [] : ['listOrganizationRoles']), ...(stopAt === 'user' ? ['getUser'] : [])]);
  });
}

test('Given two members on one page, when the first user read aborts the signal, then the second user read never starts', async () => {
  const double = new WorkOSOrganizationsDouble();
  const first = membership({ roles: roles('admin') });
  const second = membership({ id: 'member-b', userId: 'user-b' });
  double.membershipList = { data: [first, second], after: null };
  double.emails.set(first.userId, 'first@example.com');
  double.emails.set(second.userId, 'second@example.com');
  const controller = new AbortController();
  const reason = new Error('The owner stopped');
  const readUser = double.userManagement.getUser;
  double.userManagement.getUser = async id => { const result = await readUser(id); controller.abort(reason); return result; };
  await assert.rejects(double.directory().memberPage({ organizationId: acme, statuses: ['active'], signal: controller.signal }), error => error === reason);
  assert.deepEqual(double.calls.filter(call => call.method === 'getUser'), [{ method: 'getUser', input: first.userId }]);
});
