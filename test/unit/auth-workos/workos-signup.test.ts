import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorkOSSignup } from '../../../src/auth/hosted-auth/workos/workos-signup.ts';
import { SignupClientFake, documents, user } from './fixtures/signup-client-fake.ts';

test('Given a verified identity without access, when it accepts the documents, then one personal workspace receives only User access', async () => {
  const fake = new SignupClientFake();
  const signup = new WorkOSSignup(fake.options());
  assert.deepEqual(await signup.activate({ user, documents, signal: new AbortController().signal }), { status: 'active', organizationId: 'org_personal' });
  assert.equal(fake.organizationWrites.length, 1);
  assert.deepEqual(fake.membershipWrites, [{ organizationId: 'org_personal', userId: user.subject, roleSlug: 'user' }]);
});

const activate = (fake: SignupClientFake, signal = new AbortController().signal) => new WorkOSSignup(fake.options()).activate({ user, documents, signal });

test('Given eight concurrent requests for one subject, when they activate, then only the confirmed organization creator attempts the grant', async () => {
  const fake = new SignupClientFake();
  const outcomes = await Promise.all(Array.from({ length: 8 }, () => activate(fake)));
  assert.ok(outcomes.some((result) => result.status === 'active'));
  assert.equal(fake.organizationWrites.length, 8);
  assert.equal(new Set(fake.organizationWrites.map((write) => write.externalId)).size, 1);
  assert.equal(fake.membershipWrites.length, 1);
  assert.ok(outcomes.every((result) => result.status === 'active' || result.status === 'support-required'));
});

for (const emailVerified of [false, undefined]) {
  test(`Given emailVerified is ${emailVerified}, when activation is requested, then no access is granted`, async () => {
    const fake = new SignupClientFake();
    Object.assign(fake.currentUser, { emailVerified });
    assert.deepEqual(await activate(fake), { status: 'unverified' });
    assert.equal(fake.organizationWrites.length, 0);
    assert.equal(fake.membershipWrites.length, 0);
  });
}

test('Given WorkOS returns another current user, when activation is requested, then it fails before any write', async () => {
  const fake = new SignupClientFake();
  fake.currentUser.id = 'user_someone_else';
  assert.deepEqual(await activate(fake), { status: 'unavailable' });
  assert.equal(fake.organizationWrites.length, 0);
});

test('Given existing product access and no personal record, when activation is requested, then it uses existing access without a new workspace', async () => {
  const fake = new SignupClientFake();
  fake.existingAccess = [{ organizationId: 'org_existing', organizationName: 'Existing', active: true, grants: [{ role: 'user', permissions: ['product:access'] }] }];
  assert.deepEqual(await activate(fake), { status: 'existing-access' });
  assert.equal(fake.organizationWrites.length, 0);
  assert.equal(fake.membershipWrites.length, 0);
});

test('Given only Admin access, when activation is requested, then a separate personal workspace gets User access', async () => {
  const fake = new SignupClientFake();
  fake.existingAccess = [{ organizationId: 'org_existing', organizationName: 'Existing', active: true, grants: [{ role: 'admin', permissions: ['user-grants:manage'] }] }];
  assert.equal((await activate(fake)).status, 'active');
  assert.deepEqual(fake.membershipWrites, [{ organizationId: 'org_personal', userId: user.subject, roleSlug: 'user' }]);
});

for (const state of ['absent', 'pending', 'inactive', 'non-product', 'directory-managed'] as const) {
  test(`Given a retained personal record with ${state} membership, when a restarted service activates, then it requires support without repair`, async () => {
    const fake = new SignupClientFake();
    assert.equal((await activate(fake)).status, 'active');
    if (state === 'absent') fake.memberships = [];
    else fake.memberships = [{ ...fake.memberships[0], ...(state === 'directory-managed' ? { directoryManaged: true }
      : state === 'non-product' ? { roles: [{ slug: 'member' }] } : { status: state }) }];
    assert.deepEqual(await activate(fake), { status: 'support-required' });
    assert.equal(fake.organizationWrites.length, 1);
    assert.equal(fake.membershipWrites.length, 1);
  });
}

test('Given a retained personal record with current product access, when a new document version is shown, then existing access remains usable without a new acceptance write', async () => {
  const fake = new SignupClientFake();
  await activate(fake);
  const next = { ...documents, version: 'bundle-v2', terms: { ...documents.terms, version: 'terms-v2' } };
  assert.deepEqual(await new WorkOSSignup(fake.options()).activate({ user, documents: next, signal: new AbortController().signal }), { status: 'active', organizationId: 'org_personal' });
  assert.equal(fake.organizationWrites.length, 1);
  assert.equal(fake.membershipWrites.length, 1);
});

for (const field of ['subject', 'schema', 'terms_sha256', 'accepted_at'] as const) {
  test(`Given a retained personal record with invalid ${field}, when activation is requested, then no membership is restored`, async () => {
    const fake = new SignupClientFake();
    await activate(fake);
    const saved = fake.organization;
    assert.ok(saved);
    fake.organization = { ...saved, metadata: { ...saved.metadata, [field]: 'invalid' } };
    assert.deepEqual(await activate(fake), { status: 'support-required' });
    assert.equal(fake.membershipWrites.length, 1);
  });
}

for (const failure of ['before', 'after'] as const) {
  test(`Given organization creation fails ${failure} persistence, when activation retries after restart, then only a confirmed fresh creation can grant`, async () => {
    const fake = new SignupClientFake();
    fake.organizationFailure = failure;
    assert.deepEqual(await activate(fake), { status: failure === 'before' ? 'unavailable' : 'support-required' });
    assert.equal(fake.membershipWrites.length, 0);
    fake.organizationFailure = undefined;
    assert.equal((await activate(fake)).status, failure === 'before' ? 'active' : 'support-required');
    assert.equal(fake.membershipWrites.length, failure === 'before' ? 1 : 0);
  });

  test(`Given membership creation fails ${failure} persistence, when activation restarts, then its grant is never repeated`, async () => {
    const fake = new SignupClientFake();
    fake.membershipFailure = failure;
    const expected = failure === 'before' ? { status: 'support-required' } : { status: 'active', organizationId: 'org_personal' };
    assert.deepEqual(await activate(fake), expected);
    fake.membershipFailure = undefined;
    assert.deepEqual(await activate(fake), expected);
    assert.equal(fake.membershipWrites.length, 1);
    assert.equal(fake.organizationWrites.length, 1);
  });
}

test('Given a changed User role removes live product permission, when a retained activation is read, then it cannot report active or restore the role', async () => {
  const fake = new SignupClientFake();
  await activate(fake);
  fake.roles = fake.roles.map((role) => role.slug === 'user' ? { ...role, permissions: [] } : role);
  assert.deepEqual(await activate(fake), { status: 'unavailable' });
  assert.equal(fake.membershipWrites.length, 1);
});

test('Given role configuration fails before the grant, when activation is requested, then the retained record blocks automatic recovery', async () => {
  const fake = new SignupClientFake();
  const roles = fake.roles;
  fake.roles = roles.filter((role) => role.slug !== 'member');
  assert.deepEqual(await activate(fake), { status: 'unavailable' });
  fake.roles = roles;
  assert.deepEqual(await activate(fake), { status: 'support-required' });
  assert.equal(fake.membershipWrites.length, 0);
});

for (const boundary of ['afterOrganizationCreate', 'afterOrganizationRead', 'afterRolesRead', 'afterMembershipRead'] as const) {
  test(`Given a request is cancelled ${boundary}, when activation continues, then it performs no membership write`, async () => {
    const fake = new SignupClientFake();
    const controller = new AbortController();
    fake[boundary] = () => controller.abort();
    assert.deepEqual(await activate(fake, controller.signal), { status: 'unavailable' });
    assert.equal(fake.membershipWrites.length, 0);
    assert.equal((await activate(fake)).status, 'support-required');
    assert.equal(fake.membershipWrites.length, 0);
  });
}

test('Given another membership appears before the initial grant, when all membership statuses are read, then it prevents creation', async () => {
  const fake = new SignupClientFake();
  fake.afterOrganizationCreate = () => { fake.memberships = [{ userId: 'user_other', organizationId: 'org_personal', status: 'pending', directoryManaged: true, roles: [{ slug: 'member' }] }]; };
  assert.deepEqual(await activate(fake), { status: 'support-required' });
  assert.equal(fake.membershipWrites.length, 0);
  assert.deepEqual(fake.membershipReads[0]?.statuses, ['active', 'pending', 'inactive']);
  assert.equal(fake.membershipReads[0]?.userId, undefined);
});

test('Given an unbounded membership result, when the provider repeats a cursor, then activation stops without a grant', async () => {
  const fake = new SignupClientFake();
  fake.readAfter = 'repeated';
  assert.deepEqual(await activate(fake), { status: 'unavailable' });
  assert.equal(fake.membershipReads.length, 2);
  assert.equal(fake.membershipWrites.length, 0);
});

test('Given a failed record read, when activation is requested, then the failure cannot become missing state or expose the provider error', async () => {
  const fake = new SignupClientFake();
  fake.readFailure = true;
  assert.deepEqual(await activate(fake), { status: 'unavailable' });
  assert.equal(fake.organizationWrites.length, 0);
  assert.equal(fake.membershipWrites.length, 0);
});

test('Given eligible activation, when the organization is saved, then its immutable acceptance facts and reserved identity use no email or domains', async () => {
  const fake = new SignupClientFake();
  await activate(fake);
  const [write] = fake.organizationWrites;
  assert.ok(write.externalId && write.externalId.length <= 64);
  assert.match(write.externalId, /^thermus-signup:[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(Object.keys(write).sort(), ['externalId', 'metadata', 'name']);
  assert.deepEqual(write.metadata, { schema: 'thermus-signup-v1', subject: user.subject, accepted_at: '2026-10-16T12:00:00.000Z',
    documents_version: documents.version, terms_version: documents.terms.version, terms_sha256: documents.terms.sha256,
    notice_version: documents.notice.version, notice_sha256: documents.notice.sha256, agreement_version: documents.agreement.version });
});

test('Given an acceptance time that only loosely parses as a date, when a retained record is read, then it requires support', async () => {
  const fake = new SignupClientFake();
  await activate(fake);
  const saved = fake.organization;
  assert.ok(saved);
  fake.organization = { ...saved, metadata: { ...saved.metadata, accepted_at: '1' } };
  assert.deepEqual(await activate(fake), { status: 'support-required' });
  assert.equal(fake.membershipWrites.length, 1);
});

for (const mutation of ['metadata', 'external-id', 'domains', 'id'] as const) {
  test(`Given the saved organization reread changes ${mutation}, when its creation winner proceeds, then no membership is granted`, async () => {
    const fake = new SignupClientFake();
    fake.afterOrganizationRead = () => {
      const saved = fake.organization;
      assert.ok(saved);
      fake.organization = mutation === 'metadata' ? { ...saved, metadata: { ...saved.metadata, agreement_version: 'different' } }
        : mutation === 'external-id' ? { ...saved, externalId: 'another-organization' }
        : mutation === 'domains' ? { ...saved, domains: [{ domain: 'example.com' }] } : { ...saved, id: 'org_other' };
    };
    assert.deepEqual(await activate(fake), { status: 'support-required' });
    assert.equal(fake.membershipWrites.length, 0);
  });
}

test('Given an unrelated role gains product permission, when activation checks all effective roles, then it blocks the initial User grant', async () => {
  const fake = new SignupClientFake();
  fake.roles = [...fake.roles, { slug: 'unrelated', permissions: ['product:access'] }];
  assert.deepEqual(await activate(fake), { status: 'unavailable' });
  assert.equal(fake.membershipWrites.length, 0);
});

test('Given the post-write membership has an extra Admin role, when activation confirms the result, then it cannot report a User-only activation', async () => {
  const fake = new SignupClientFake();
  fake.afterMembershipRead = () => {
    if (fake.membershipWrites.length !== 0) fake.memberships = [{ ...fake.memberships[0], roles: [{ slug: 'user' }, { slug: 'admin' }] }];
  };
  assert.deepEqual(await activate(fake), { status: 'support-required' });
  assert.equal(fake.membershipWrites.length, 1);
});
