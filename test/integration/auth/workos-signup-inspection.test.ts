import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adminGrant } from '../../support/fixtures/hosted-roles.ts';
import { WorkOSSignup } from '../../../src/accounts/providers/workos/workos-signup.ts';
import { SignupClientFake, documents, organizationName, user } from './fixtures/signup-client-fake.ts';

const inspect = (fake: SignupClientFake, signal = new AbortController().signal) => new WorkOSSignup(fake.options()).inspect({ user, signal });
const activate = (fake: SignupClientFake) => new WorkOSSignup(fake.options()).activate({ user, organizationName, documents, signal: new AbortController().signal });
const otherAccess = { organizationId: 'org_other', organizationName: 'Other workspace', active: true, grants: [{ role: 'user', permissions: ['product:access' as const] }] };
const recordOf = (status: 'active' | 'pending' | 'inactive', role = 'user') => ({ userId: user.subject, organizationId: 'org_other', status, directoryManaged: false, roles: [{ slug: role }] });

test('Given no creation record or product access, when signup state is inspected, then it is eligible after a current-user read without a provider write', async () => {
  const fake = new SignupClientFake();

  assert.deepEqual(await inspect(fake), { status: 'eligible' });
  assert.deepEqual(fake.organizationWrites, []);
  assert.deepEqual(fake.membershipWrites, []);
});

for (const status of ['active', 'pending', 'inactive'] as const) {
  test(`Given a membership record with status ${status} in another organization and no creation record, when signup state is inspected, then it is eligible without a membership read or a provider write`, async () => {
    const fake = new SignupClientFake();
    fake.memberships = [recordOf(status, 'member')];

    assert.deepEqual(await inspect(fake), { status: 'eligible' });
    assert.deepEqual(fake.membershipReads, []);
    assert.deepEqual(fake.organizationWrites, []);
    assert.deepEqual(fake.membershipWrites, []);
  });
}

test('Given product access in another organization and an unverified email, when signup state is inspected, then it is eligible without a provider write', async () => {
  const fake = new SignupClientFake();
  fake.currentUser.emailVerified = false;
  fake.existingAccess = [otherAccess];

  assert.deepEqual(await inspect(fake), { status: 'eligible' });
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

test('Given only active Admin access in another organization and no creation record, when signup state is inspected, then it is eligible without a write', async () => {
  const fake = new SignupClientFake();
  fake.existingAccess = [{ ...otherAccess, grants: [adminGrant] }];
  assert.deepEqual(await inspect(fake), { status: 'eligible' });
  assert.deepEqual(fake.organizationWrites, []);
  assert.deepEqual(fake.membershipWrites, []);
});

test('Given a provider read fails, when signup state is inspected, then the failure cannot become eligibility', async () => {
  const fake = new SignupClientFake();
  fake.readFailure = true;
  assert.deepEqual(await inspect(fake), { status: 'unavailable' });
  assert.deepEqual(fake.organizationWrites, []);
  assert.deepEqual(fake.membershipWrites, []);
});

test('Given a retained creation record without usable access and a failing membership discovery, when signup state is inspected, then it is unavailable and offers no Continue', async () => {
  const fake = new SignupClientFake();
  assert.equal((await activate(fake)).status, 'active');
  fake.memberships = [];
  const options = fake.options();
  options.directory.membershipsOf = async () => { throw new Error('provider secret'); };
  assert.deepEqual(await new WorkOSSignup(options).inspect({ user, signal: new AbortController().signal }), { status: 'unavailable' });
  assert.equal(fake.organizationWrites.length, 1);
  assert.equal(fake.membershipWrites.length, 1);
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

test('Given a retained creation record without usable access and membership discovery that returns 404, when signup state is inspected, then it stays unavailable without writes', async () => {
  const fake = new SignupClientFake();
  assert.equal((await activate(fake)).status, 'active');
  fake.memberships = [];
  const options = fake.options();
  options.directory.membershipsOf = async () => { throw Object.assign(new Error('membership read failed'), { status: 404 }); };
  assert.deepEqual(await new WorkOSSignup(options).inspect({ user, signal: new AbortController().signal }), { status: 'unavailable' });
  assert.equal(fake.organizationWrites.length, 1);
  assert.equal(fake.membershipWrites.length, 1);
});

test('Given membership discovery that would fail and no creation record, when a verified identity activates, then the organization and first Admin are created without a directory read', async () => {
  const fake = new SignupClientFake();
  const options = fake.options();
  let directoryReads = 0;
  options.directory.membershipsOf = async () => { directoryReads++; throw Object.assign(new Error('membership read failed'), { status: 404 }); };
  assert.deepEqual(await new WorkOSSignup(options).activate({ user, organizationName, documents, signal: new AbortController().signal }), { status: 'active', organizationId: 'org_personal' });
  assert.equal(directoryReads, 0);
  assert.equal(fake.organizationWrites.length, 1);
  assert.deepEqual(fake.membershipWrites, [{ organizationId: 'org_personal', userId: user.subject, roleSlug: 'admin' }]);
});

// Step 1 of free access asks WorkOS for a user of the typed email before the provider sign-up starts.
const findAccount = (fake: SignupClientFake, email = 'person@example.com', signal = new AbortController().signal) => new WorkOSSignup(fake.options()).findAccount({ email, signal });

test('Given a WorkOS user with the email, when step 1 looks up the account, then it is found after one read of at most one user of that email, without a write', async () => {
  const fake = new SignupClientFake();
  fake.users = [{ id: 'user_existing', email: 'person@example.com' }];

  assert.deepEqual(await findAccount(fake), { status: 'found' });
  assert.deepEqual(fake.userReads, [{ email: 'person@example.com', limit: 1 }]);
  assert.deepEqual(fake.organizationWrites, []);
  assert.deepEqual(fake.membershipWrites, []);
});

test('Given a WorkOS user whose email has other capital letters, when step 1 looks up the lowercase email, then it is found', async () => {
  const fake = new SignupClientFake();
  fake.users = [{ id: 'user_existing', email: 'Person@Example.com' }];

  assert.deepEqual(await findAccount(fake), { status: 'found' });
});

test('Given no WorkOS user with the email, when step 1 looks up the account, then it is absent', async () => {
  const fake = new SignupClientFake();
  fake.users = [{ id: 'user_other', email: 'other@example.com' }];

  assert.deepEqual(await findAccount(fake), { status: 'absent' });
  assert.equal(fake.userReads.length, 1);
});

for (const [answer, data] of [['a user of another email', [{ email: 'other@example.com' }]], ['a user without an email', [{}]], ['no list', undefined]] as const) {
  test(`Given WorkOS answers ${answer}, when step 1 looks up the account, then the answer is not valid and the lookup is unavailable`, async () => {
    const fake = new SignupClientFake();
    const options = fake.options();
    options.workos.userManagement.listUsers = async () => ({ data } as never);

    assert.deepEqual(await new WorkOSSignup(options).findAccount({ email: 'person@example.com', signal: new AbortController().signal }), { status: 'unavailable' });
  });
}

test('Given the WorkOS user read fails, when step 1 looks up the account, then the lookup is unavailable', async () => {
  const fake = new SignupClientFake();
  fake.userReadFailure = true;

  assert.deepEqual(await findAccount(fake), { status: 'unavailable' });
  assert.equal(fake.userReads.length, 1);
});

test('Given a request is cancelled during the user read, when the read returns a user, then the lookup is unavailable', async () => {
  const fake = new SignupClientFake();
  const controller = new AbortController();
  fake.users = [{ id: 'user_existing', email: 'person@example.com' }];
  fake.afterUserRead = () => controller.abort();

  assert.deepEqual(await findAccount(fake, 'person@example.com', controller.signal), { status: 'unavailable' });
  assert.equal(fake.userReads.length, 1);
});

test('Given a request that is already cancelled, when step 1 looks up the account, then no user read starts and the lookup is unavailable', async () => {
  const fake = new SignupClientFake();
  const controller = new AbortController();
  controller.abort();

  assert.deepEqual(await findAccount(fake, 'person@example.com', controller.signal), { status: 'unavailable' });
  assert.deepEqual(fake.userReads, []);
});
