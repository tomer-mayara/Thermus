import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { WorkOSGoogleOnboarding } from '../../../src/accounts/providers/workos/workos-google-onboarding.ts';
import { WorkOSOrganizations, workosMembershipReads } from '../../../src/accounts/providers/workos/workos-organizations.ts';
import type { ChangeRecord } from '../../../src/accounts/organizations/change-records.ts';
import { WorkOSFake, type FakeUser } from '../../support/doubles/workos/workos-fake.ts';

const organizationId = 'org_SLICE';
const user: FakeUser = { id: 'user_NEW', email: 'new@thermus.ai', firstName: 'New' };
const internalError = { status: 500, body: { message: 'Internal error' } };

async function fixture(t: TestContext) {
  const world = await WorkOSFake.start(t, 'https://thermus.example/', [organizationId]);
  world.users = [user];
  world.authenticationMethod = 'GoogleOAuth';
  const { workos, settings } = world.connection();
  const records: ChangeRecord[] = [];
  const seats: number[] = [];
  const directory = new WorkOSOrganizations({ authority: 'workos:client_test', memberships: workosMembershipReads(workos), userManagement: workos.userManagement, authorization: workos.authorization });
  const policy = new WorkOSGoogleOnboarding({ organizationId, authority: 'workos:client_test', workos, settings, directory,
    records: { record: (entry) => records.push(entry) }, billing: { stateOf: async () => ({ organizationId, plan: 'free', memberLimit: 5, billedSeats: 0 }), updateSeats: async (_id, count) => {
      seats.push(count); return { organizationId, plan: 'free', memberLimit: 5, billedSeats: 0 };
    } },
  });
  const exchange = (who: FakeUser = user) => workos.userManagement.authenticateWithCode({ clientId: settings.clientId, code: world.codeFor(who), session: { sealSession: true, cookiePassword: settings.cookiePassword } });
  const creates = () => world.fake.takeRequests().filter(({ method, path }) => method === 'POST' && path === '/user_management/organization_memberships');
  return { world, workos, policy, exchange, records, seats, creates };
}

test('Given eligible concurrent callbacks, when both enroll, then one explicit User membership is created, both sessions select its organization, and repeated callbacks do not rewrite roles', async (t) => {
  const f = await fixture(t);
  const inputs = await Promise.all([f.exchange(), f.exchange()]);
  const results = await Promise.all(inputs.map((exchange) => f.policy.complete(exchange)));
  assert.deepEqual(results.map(({ organizationId }) => organizationId), ['org_SLICE', 'org_SLICE']);
  assert.deepEqual(f.creates().map(({ body }) => body), [{ organization_id: organizationId, user_id: user.id, role_slug: 'user' }]);
  assert.deepEqual(f.world.rolesOf(user, organizationId), ['user']);
  assert.deepEqual(f.records.map(({ outcome }) => outcome), ['applied', 'unchanged']);
  assert.deepEqual(f.seats, [1]);
  await f.policy.complete(await f.exchange());
  assert.equal(f.creates().length, 0);
});

for (const roles of [['member'], ['admin'], ['super-admin'], ['user']]) {
  for (const status of ['active', 'pending', 'inactive'] as const) {
    if (roles[0] === 'user' && status === 'active') continue;
    test(`Given an existing ${status} membership with ${roles}, when eligible Google onboarding runs, then roles and status stay unchanged and it gives no new organization session`, async (t) => {
      const f = await fixture(t);
      f.world.memberships = [{ userId: user.id, organizationId, roles, status }];
      const input = await f.exchange();
      assert.equal(await f.policy.complete(input), input);
      assert.deepEqual(f.world.rolesOf(user, organizationId), roles);
      assert.equal(f.world.statusOf(user, organizationId), status);
      assert.equal(f.creates().length, 0);
      assert.equal(f.records[0]?.outcome, 'denied');
    });
  }
}

for (const identity of [
  { email: 'new@sub.thermus.ai' }, { email: 'new@thermus.ai.evil.example' }, { email: 'new@elsewhere.example' },
  { email: 'new@@thermus.ai' }, { email: 'new@thermus.ai', emailVerified: false },
]) {
  test(`Given ineligible identity ${JSON.stringify(identity)}, when sign-in completes, then onboarding reads and changes no membership`, async (t) => {
    const f = await fixture(t);
    const exchange = await f.exchange({ ...user, ...identity });
    f.world.fake.takeRequests();
    assert.equal(await f.policy.complete(exchange), exchange);
    assert.deepEqual(f.world.fake.takeRequests(), []);
    assert.deepEqual(f.records, []);
  });
}

for (const authenticationMethod of ['Password', 'SSO', undefined]) {
  test(`Given a verified domain user with method ${authenticationMethod}, when sign-in completes, then onboarding makes no grant`, async (t) => {
    const f = await fixture(t);
    const exchange = { ...await f.exchange(), authenticationMethod };
    f.world.fake.takeRequests();
    assert.equal(await f.policy.complete(exchange), exchange);
    assert.deepEqual(f.world.fake.takeRequests(), []);
  });
}

test('Given a provider create with an unknown result and no membership on read-back, when another callback arrives, then the policy records unknown and does not blindly repeat the create', async (t) => {
  const f = await fixture(t);
  f.world.fake.answer('POST /user_management/organization_memberships', internalError);
  await assert.rejects(f.policy.complete(await f.exchange()));
  assert.equal(f.creates().length, 1);
  await assert.rejects(f.policy.complete(await f.exchange()), /not known/);
  assert.equal(f.creates().length, 0);
  assert.deepEqual(f.records.map(({ outcome }) => outcome), ['unknown', 'failed']);
});

test('Given a create applied before its response failed, when read-back finds its active User membership, then onboarding selects the organization with an unknown change record and no second create', async (t) => {
  const f = await fixture(t);
  f.world.fake.answer('POST /user_management/organization_memberships', () => {
    f.world.memberships = [{ userId: user.id, organizationId, roles: ['user'] }];
    return internalError;
  });
  assert.equal((await f.policy.complete(await f.exchange())).organizationId, organizationId);
  assert.equal(f.creates().length, 1);
  assert.equal(f.records[0]?.outcome, 'unknown');
  assert.deepEqual(f.seats, [1]);
});

test('Given an active User whose role is removed, when another callback completes, then onboarding does not restore User; deletion permits a later fresh enrollment', async (t) => {
  const f = await fixture(t);
  await f.policy.complete(await f.exchange());
  f.world.setRoles(user, organizationId, ['member']);
  assert.equal((await f.policy.complete(await f.exchange())).organizationId, undefined);
  assert.deepEqual(f.world.rolesOf(user, organizationId), ['member']);
  f.world.memberships = [];
  assert.equal((await f.policy.complete(await f.exchange())).organizationId, organizationId);
});

test('Given a completed enrollment and a refresh failure, when the callback completes, then it rejects and a later callback refreshes the existing User without a new create', async (t) => {
  const f = await fixture(t);
  f.world.refreshOutage = internalError;
  await assert.rejects(f.policy.complete(await f.exchange()), /refresh/);
  assert.deepEqual(f.world.rolesOf(user, organizationId), ['user']);
  assert.equal(f.creates().length, 1);
  f.world.refreshOutage = undefined;
  assert.equal((await f.policy.complete(await f.exchange())).organizationId, organizationId);
  assert.equal(f.creates().length, 0);
});

for (const result of [
  { authenticated: true, user: { id: 'another-user' }, organizationId, sealedSession: 'seal' },
  { authenticated: true, user, organizationId: 'another-org', sealedSession: 'seal' },
  { authenticated: true, user, organizationId },
  { authenticated: false, reason: 'membership_missing', retryable: false },
]) {
  test(`Given a refresh outside its success contract ${JSON.stringify(result)}, when onboarding completes, then it rejects without returning a session`, async (t) => {
    const f = await fixture(t);
    const input = await f.exchange();
    t.mock.method(f.workos.userManagement, 'loadSealedSession', () => ({ refresh: async () => result }));
    await assert.rejects(f.policy.complete(input));
    assert.deepEqual(f.world.rolesOf(user, organizationId), ['user']);
    assert.equal(f.creates().length, 1);
  });
}

test('Given an existing active User and another role with a normalized uppercase domain address, when onboarding completes, then the session selects the configured organization and all roles stay', async (t) => {
  const f = await fixture(t);
  f.world.memberships = [{ userId: user.id, organizationId, roles: ['admin', 'user'] }];
  const result = await f.policy.complete(await f.exchange({ ...user, email: ' NEW@THERMUS.AI ' }));
  assert.equal(result.organizationId, organizationId);
  assert.deepEqual(f.world.rolesOf(user, organizationId), ['admin', 'user']);
  assert.equal(f.creates().length, 0);
  assert.deepEqual(f.seats, []);
});

test('Given a membership read outage, when onboarding completes, then it records failed and never creates a membership', async (t) => {
  const f = await fixture(t);
  f.world.membershipOutage = internalError;
  await assert.rejects(f.policy.complete(await f.exchange()));
  assert.equal(f.creates().length, 0);
  assert.deepEqual(f.records.map(({ outcome }) => outcome), ['failed']);
});

for (const records of [
  [{ id: 'om_wrong', user_id: 'another-user', organization_id: organizationId, status: 'active', roles: [{ slug: 'user' }] }],
  [{ id: 'om_wrong', user_id: user.id, organization_id: 'another-org', status: 'active', roles: [{ slug: 'user' }] }],
  [{ id: 'om_wrong', user_id: user.id, organization_id: organizationId, status: 'active' }],
]) {
  test(`Given a membership read outside its contract ${JSON.stringify(records)}, when onboarding completes, then it fails before create`, async (t) => {
    const f = await fixture(t);
    f.world.fake.answer('GET /user_management/organization_memberships', { status: 200, body: { object: 'list', data: records, list_metadata: { after: null, before: null } } });
    await assert.rejects(f.policy.complete(await f.exchange()));
    assert.equal(f.creates().length, 0);
    assert.equal(f.records[0]?.outcome, 'failed');
  });
}

test('Given a Google code exchange with no email verification fact, when onboarding completes, then it makes no membership read or grant', async (t) => {
  const f = await fixture(t);
  const exchange = await f.exchange();
  const { emailVerified: _verification, ...withoutVerification } = exchange.user;
  const input = { ...exchange, user: withoutVerification };
  f.world.fake.takeRequests();
  assert.equal(await f.policy.complete(input), input);
  assert.deepEqual(f.world.fake.takeRequests(), []);
});
