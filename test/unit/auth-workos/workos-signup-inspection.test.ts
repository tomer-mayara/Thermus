import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorkOSSignup } from '../../../src/auth/hosted-auth/workos/workos-signup.ts';
import { SignupWorkOSFake, documents, user } from './fixtures/signup-workos-fake.ts';

const inspect = (fake: SignupWorkOSFake, signal = new AbortController().signal) => new WorkOSSignup(fake.options()).inspect({ user, signal });
const activate = (fake: SignupWorkOSFake) => new WorkOSSignup(fake.options()).activate({ user, documents, signal: new AbortController().signal });
const otherAccess = { organizationId: 'org_other', organizationName: 'Other workspace', active: true, grants: [{ role: 'user', permissions: ['product:access' as const] }] };

test('Given no personal record or product access, when signup state is inspected, then it is eligible without a user lookup or provider write', async () => {
  const fake = new SignupWorkOSFake();
  fake.userManagement.getUser = async () => { throw new Error('An inspection must not verify a new activation'); };

  assert.deepEqual(await inspect(fake), { status: 'eligible' });
  assert.deepEqual(fake.organizationWrites, []);
  assert.deepEqual(fake.membershipWrites, []);
});

test('Given current product access and an unverified email, when signup state is inspected, then existing access can continue without another agreement', async () => {
  const fake = new SignupWorkOSFake();
  fake.currentUser.emailVerified = false;
  fake.existingAccess = [otherAccess];

  assert.deepEqual(await inspect(fake), { status: 'existing-access' });
  assert.deepEqual(fake.organizationWrites, []);
  assert.deepEqual(fake.membershipWrites, []);
});

test('Given an active personal workspace, when signup state is inspected without documents, then existing access remains usable without another write', async () => {
  const fake = new SignupWorkOSFake();
  assert.equal((await activate(fake)).status, 'active');

  assert.deepEqual(await inspect(fake), { status: 'existing-access' });
  assert.equal(fake.organizationWrites.length, 1);
  assert.equal(fake.membershipWrites.length, 1);
});

for (const state of ['absent', 'pending', 'inactive', 'non-product', 'directory-managed', 'duplicate', 'invalid-record'] as const) {
  test(`Given a retained personal record with ${state} state, when inspected, then support is required and another workspace remains usable without repair`, async () => {
    const fake = new SignupWorkOSFake();
    assert.equal((await activate(fake)).status, 'active');
    if (state === 'absent') fake.memberships = [];
    else if (state === 'duplicate') fake.memberships.push(fake.memberships[0]);
    else if (state === 'invalid-record') {
      assert.ok(fake.organization);
      fake.organization = { ...fake.organization, metadata: { ...fake.organization.metadata, subject: 'someone-else' } };
    } else fake.memberships = [{ ...fake.memberships[0], ...(state === 'directory-managed' ? { directoryManaged: true }
      : state === 'non-product' ? { roles: [{ slug: 'member' }] } : { status: state }) }];
    fake.existingAccess = [{ ...otherAccess, organizationId: 'org_personal' }];

    assert.deepEqual(await inspect(fake), { status: 'support-required', canContinue: false });
    fake.existingAccess = [...fake.existingAccess, otherAccess];
    assert.deepEqual(await inspect(fake), { status: 'support-required', canContinue: true });
    assert.equal(fake.organizationWrites.length, 1);
    assert.equal(fake.membershipWrites.length, 1);
  });
}

test('Given only an admin grant or an inactive User grant, when inspected, then signup remains eligible', async () => {
  const fake = new SignupWorkOSFake();
  fake.existingAccess = [{ ...otherAccess, active: false }, { ...otherAccess, grants: [{ role: 'admin', permissions: ['user-grants:manage'] }] }];
  assert.deepEqual(await inspect(fake), { status: 'eligible' });
  assert.deepEqual(fake.organizationWrites, []);
});

test('Given a provider read fails, when signup state is inspected, then the failure cannot become eligibility', async () => {
  const fake = new SignupWorkOSFake();
  fake.readFailure = true;
  assert.deepEqual(await inspect(fake), { status: 'unavailable' });
  assert.deepEqual(fake.organizationWrites, []);
  assert.deepEqual(fake.membershipWrites, []);
});

test('Given membership discovery fails, when signup state is inspected, then the failure cannot become eligibility', async () => {
  const fake = new SignupWorkOSFake();
  const options = fake.options();
  options.directory.membershipsOf = async () => { throw new Error('provider secret'); };
  assert.deepEqual(await new WorkOSSignup(options).inspect({ user, signal: new AbortController().signal }), { status: 'unavailable' });
  assert.deepEqual(fake.organizationWrites, []);
});

test('Given a request is cancelled during a personal-record lookup, when the read returns, then no next provider call starts', async () => {
  const fake = new SignupWorkOSFake();
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
  const fake = new SignupWorkOSFake();
  fake.organizations.getOrganizationByExternalId = async () => { assert.fail('Unexpected organization lookup'); };
  assert.deepEqual(await new WorkOSSignup(fake.options()).inspect({ user: { ...user, authority: 'other' }, signal: new AbortController().signal }), { status: 'unavailable' });
});
