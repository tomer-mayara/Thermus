import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adminGrant, memberRole, superAdminGrant } from '../../support/fixtures/hosted-roles.ts';
import { WorkOSSignup } from '../../../src/accounts/providers/workos/workos-signup.ts';
import { RemovedMemberStoreSpy, SignupClientFake, documents, organizationName, user } from './fixtures/signup-client-fake.ts';

const inspect = (fake: SignupClientFake, signal = new AbortController().signal) => new WorkOSSignup(fake.options()).inspect({ user, signal });
const activate = (fake: SignupClientFake) => new WorkOSSignup(fake.options()).activate({ user, organizationName, documents, signal: new AbortController().signal });
const runSignup = (fake: SignupClientFake, operation: 'inspect' | 'activate', signal = new AbortController().signal) => new WorkOSSignup(fake.options())[operation]({ user, organizationName, documents, signal });
const otherAccess = { organizationId: 'org_other', organizationName: 'Other workspace', active: true, grants: [{ role: 'user', permissions: ['product:access' as const] }] };
const recordOf = (status: 'active' | 'pending' | 'inactive', role = 'user') => ({ userId: user.subject, organizationId: 'org_other', status, directoryManaged: false, roles: [{ slug: role }] });

test('Given no creation record or product access, when signup state is inspected, then it is eligible after a current-user read without a provider write', async () => {
  const fake = new SignupClientFake();

  assert.deepEqual(await inspect(fake), { status: 'eligible' });
  assert.deepEqual(fake.organizationWrites, []);
  assert.deepEqual(fake.membershipWrites, []);
});

test('Given no membership record, when signup state is inspected, then one read asks WorkOS for one record of any status of this user, and signup stays eligible', async () => {
  const fake = new SignupClientFake();

  assert.deepEqual(await inspect(fake), { status: 'eligible' });
  assert.deepEqual(fake.membershipReads, [{ userId: user.subject, statuses: ['active', 'pending', 'inactive'], limit: 1 }]);
});

for (const status of ['active', 'pending', 'inactive'] as const) {
  test(`Given a membership record with status ${status} and no product access, when signup state is inspected, then it is an existing account without a provider write`, async () => {
    const fake = new SignupClientFake();
    fake.memberships = [recordOf(status, 'member')];

    assert.deepEqual(await inspect(fake), { status: 'existing-account' });
    assert.deepEqual(fake.organizationWrites, []);
    assert.deepEqual(fake.membershipWrites, []);
  });
}

for (const operation of ['inspect', 'activate'] as const) {
  test(`Given the account record read answers a record of another user, when signup ${operation} runs, then it is unavailable without a write`, async () => {
    const fake = new SignupClientFake();
    const options = fake.options();
    options.workos.userManagement.listOrganizationMemberships = async () => ({ data: [{ ...recordOf('inactive'), userId: 'user_other' }], listMetadata: {} });
    const request = { user, organizationName, documents, signal: new AbortController().signal };

    assert.deepEqual(await new WorkOSSignup(options)[operation](request), { status: 'unavailable' });
    assert.deepEqual(fake.organizationWrites, []);
    assert.deepEqual(fake.membershipWrites, []);
  });
}

test('Given a request is cancelled during the account record read, when the read returns, then signup state is unavailable', async () => {
  const fake = new SignupClientFake();
  const controller = new AbortController();
  fake.afterMembershipRead = () => controller.abort();

  assert.deepEqual(await inspect(fake, controller.signal), { status: 'unavailable' });
  assert.equal(fake.membershipReads.length, 1);
});

test('Given current product access and an unverified email, when signup state is inspected, then existing access can continue without another agreement', async () => {
  const fake = new SignupClientFake();
  fake.currentUser.emailVerified = false;
  fake.existingAccess = [otherAccess];

  assert.deepEqual(await inspect(fake), { status: 'existing-access' });
  assert.deepEqual(fake.organizationWrites, []);
  assert.deepEqual(fake.membershipWrites, []);
});

test('Given an active created organization, when signup state is inspected without documents, then existing access remains usable without another write', async () => {
  const fake = new SignupClientFake();
  assert.equal((await activate(fake)).status, 'active');

  assert.deepEqual(await inspect(fake), { status: 'existing-access' });
  assert.equal(fake.organizationWrites.length, 1);
  assert.equal(fake.membershipWrites.length, 1);
});

for (const state of ['absent', 'pending', 'inactive', 'non-product', 'directory-managed', 'duplicate', 'invalid-record'] as const) {
  test(`Given a retained creation record with ${state} state, when inspected, then support is required and another workspace remains usable without repair`, async () => {
    const fake = new SignupClientFake();
    assert.equal((await activate(fake)).status, 'active');
    if (state === 'absent') fake.memberships = [];
    else if (state === 'duplicate') fake.memberships.push(fake.memberships[0]);
    else if (state === 'invalid-record') {
      assert.ok(fake.organization);
      fake.organization = { ...fake.organization, metadata: { ...fake.organization.metadata, subject: 'someone-else' } };
    } else fake.memberships = [{ ...fake.memberships[0], ...(state === 'directory-managed' ? { directoryManaged: true }
      : state === 'non-product' ? { roles: [{ slug: 'member' }] } : { status: state }) }];
    const retained = structuredClone(fake.organization);
    const memberships = structuredClone(fake.memberships);
    fake.existingAccess = [{ ...otherAccess, organizationId: 'org_personal' }];

    assert.deepEqual(await inspect(fake), { status: 'support-required', canContinue: false });
    fake.existingAccess = [...fake.existingAccess, otherAccess];
    assert.deepEqual(await inspect(fake), { status: 'support-required', canContinue: true });
    assert.deepEqual(fake.organization, retained);
    assert.deepEqual(fake.memberships, memberships);
    assert.equal(fake.organizationWrites.length, 1);
    assert.equal(fake.membershipWrites.length, 1);
  });
}

test('Given only active Admin access, when inspected, then existing access can continue without a new workspace or membership', async () => {
  const fake = new SignupClientFake();
  fake.existingAccess = [{ ...otherAccess, grants: [adminGrant] }];
  assert.deepEqual(await inspect(fake), { status: 'existing-access' });
  assert.deepEqual(fake.organizationWrites, []);
  assert.deepEqual(fake.membershipWrites, []);
});

for (const grants of [[memberRole], [superAdminGrant]]) {
  test(`Given inactive product access and only ${grants[0].role} active access, when inspected, then these membership records make an existing account without a write`, async () => {
    const fake = new SignupClientFake();
    fake.existingAccess = [{ ...otherAccess, active: false }, { ...otherAccess, grants }];
    fake.memberships = [recordOf('inactive'), recordOf('active', grants[0].role)];
    assert.deepEqual(await inspect(fake), { status: 'existing-account' });
    assert.deepEqual(fake.organizationWrites, []);
    assert.deepEqual(fake.membershipWrites, []);
  });
}

test('Given a provider read fails, when signup state is inspected, then the failure cannot become eligibility', async () => {
  const fake = new SignupClientFake();
  fake.readFailure = true;
  assert.deepEqual(await inspect(fake), { status: 'unavailable' });
  assert.deepEqual(fake.organizationWrites, []);
  assert.deepEqual(fake.membershipWrites, []);
});

test('Given membership discovery fails, when signup state is inspected, then the failure cannot become eligibility', async () => {
  const fake = new SignupClientFake();
  const options = fake.options();
  options.directory.membershipsOf = async () => { throw new Error('provider secret'); };
  assert.deepEqual(await new WorkOSSignup(options).inspect({ user, signal: new AbortController().signal }), { status: 'unavailable' });
  assert.deepEqual(fake.organizationWrites, []);
});

test('Given a request is cancelled during a creation-record lookup, when the read returns, then no next provider call starts', async () => {
  const fake = new SignupClientFake();
  const controller = new AbortController();
  const options = fake.options();
  let directoryReads = 0;
  options.directory.membershipsOf = async () => { directoryReads++; return []; };
  fake.organizations.getOrganizationByExternalId = async () => {
    controller.abort();
    throw Object.assign(new Error('not found'), { status: 404 });
  };
  assert.deepEqual(await new WorkOSSignup(options).inspect({ user, signal: controller.signal }), { status: 'unavailable' });
  assert.equal(directoryReads, 0);
  assert.deepEqual(fake.organizationWrites, []);
});

test('Given another identity authority, when signup state is inspected, then it is unavailable without provider work', async () => {
  const fake = new SignupClientFake();
  fake.organizations.getOrganizationByExternalId = async () => { assert.fail('Unexpected organization lookup'); };
  assert.deepEqual(await new WorkOSSignup(fake.options()).inspect({ user: { ...user, authority: 'other' }, signal: new AbortController().signal }), { status: 'unavailable' });
});

for (const operation of ['inspect', 'activate'] as const) {
  for (const status of [404, 401, 403, 429, 503] as const) {
    test(`Given current-user read returns ${status}, when signup ${operation} runs, then only user absence requires sign-in and no write occurs`, async () => {
      const fake = new SignupClientFake();
      fake.userManagement.getUser = async () => { throw Object.assign(new Error('provider secret'), { status }); };
      const result = operation === 'inspect' ? await inspect(fake) : await activate(fake);
      assert.deepEqual(result, { status: status === 404 ? 'sign-in-required' : 'unavailable' });
      assert.deepEqual(fake.organizationWrites, []);
      assert.deepEqual(fake.membershipWrites, []);
    });
  }
}

test('Given current-user inspection returns another identity, when signup is inspected, then it remains unavailable without writes', async () => {
  const fake = new SignupClientFake();
  fake.currentUser.id = 'user_other';
  assert.deepEqual(await inspect(fake), { status: 'unavailable' });
  assert.deepEqual(fake.organizationWrites, []);
});

for (const operation of ['inspect', 'activate'] as const) {
  test(`Given membership discovery returns 404 for an existing user, when signup ${operation} runs, then it stays unavailable without writes`, async () => {
    const fake = new SignupClientFake();
    const options = fake.options();
    options.directory.membershipsOf = async () => { throw Object.assign(new Error('membership read failed'), { status: 404 }); };
    const signup = new WorkOSSignup(options);
    const request = { user, organizationName, documents, signal: new AbortController().signal };
    assert.deepEqual(await signup[operation](request), { status: 'unavailable' });
    assert.deepEqual(fake.organizationWrites, []);
    assert.deepEqual(fake.membershipWrites, []);
  });
}

test('Given no removed-member record, when signup state is inspected for a user with display facts, then one read names only the authority and subject, and signup stays eligible', async () => {
  const fake = new SignupClientFake();
  fake.removedMembers = new RemovedMemberStoreSpy('absent');
  const named = { ...user, name: 'Person', selectedOrganizationId: 'org_other' };

  assert.deepEqual(await new WorkOSSignup(fake.options()).inspect({ user: named, signal: new AbortController().signal }), { status: 'eligible' });
  assert.deepEqual(fake.removedMembers.reads, [{ authority: user.authority, subject: user.subject }]);
});

for (const operation of ['inspect', 'activate'] as const) {
  test(`Given a removed-member record and no membership record or product access, when signup ${operation} runs, then it is an existing account without an organization or membership write`, async () => {
    const fake = new SignupClientFake();
    fake.removedMembers = new RemovedMemberStoreSpy('found');

    assert.deepEqual(await runSignup(fake, operation), { status: 'existing-account' });
    assert.deepEqual(fake.removedMembers.reads, [{ authority: user.authority, subject: user.subject }]);
    assert.deepEqual(fake.organizationWrites, []);
    assert.deepEqual(fake.membershipWrites, []);
  });

  test(`Given the removed-member read is unavailable, when signup ${operation} runs, then the failure cannot become eligibility and no write occurs`, async () => {
    const fake = new SignupClientFake();
    fake.removedMembers = new RemovedMemberStoreSpy('unavailable');

    assert.deepEqual(await runSignup(fake, operation), { status: 'unavailable' });
    assert.equal(fake.removedMembers.reads.length, 1);
    assert.deepEqual(fake.organizationWrites, []);
    assert.deepEqual(fake.membershipWrites, []);
  });

  test(`Given a request is cancelled during the removed-member read, when signup ${operation} continues, then it is unavailable without a write`, async () => {
    const fake = new SignupClientFake();
    const controller = new AbortController();
    fake.removedMembers = new RemovedMemberStoreSpy('absent');
    fake.removedMembers.afterRead = () => controller.abort();

    assert.deepEqual(await runSignup(fake, operation, controller.signal), { status: 'unavailable' });
    assert.equal(fake.removedMembers.reads.length, 1);
    assert.deepEqual(fake.organizationWrites, []);
    assert.deepEqual(fake.membershipWrites, []);
  });

  for (const account of ['membership record', 'product access'] as const) {
    test(`Given a ${account} and a removed-member record, when signup ${operation} runs, then it decides from WorkOS without a removed-member read`, async () => {
      const fake = new SignupClientFake();
      fake.removedMembers = new RemovedMemberStoreSpy('found');
      if (account === 'membership record') fake.memberships = [recordOf('inactive')];
      else fake.existingAccess = [otherAccess];

      assert.deepEqual(await runSignup(fake, operation), { status: account === 'membership record' ? 'existing-account' : 'existing-access' });
      assert.deepEqual(fake.removedMembers.reads, []);
    });
  }
}
