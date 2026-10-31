import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorkOSOrganizations, workosMembershipReads } from '../../../src/accounts/providers/workos/workos-organizations.ts';
import { workosAuthority } from '../../../src/accounts/providers/workos/workos-settings.ts';
import { WorkOSFake } from '../../support/doubles/workos/workos-fake.ts';
import { membershipJson } from '../../support/doubles/workos/workos-fake-wire.ts';
import { hostedConfig } from '../../support/fixtures/hosted-config.ts';

const acme = 'org_01ACME';
const globex = 'org_02GLOBEX';
const alice = { id: 'user_01ALICE', email: 'alice@example.com', firstName: 'Alice' };

test('Given an ordinary active membership, another membership, an account, and a personal factor, when the directory deletes the exact membership and WorkOS confirms completion, then only that membership is absent on reread', async (t) => {
  const world = await WorkOSFake.start(t, hostedConfig.publicBaseUrl, [acme, globex]);
  world.users = [alice];
  world.memberships = [
    { userId: alice.id, organizationId: acme, roles: ['user'], directoryManaged: false },
    { userId: alice.id, organizationId: globex, roles: ['admin'], directoryManaged: false },
  ];
  const { workos } = world.connection();
  const directory = directoryFor(world);
  const targetId = world.membershipId(alice, acme);
  const otherId = world.membershipId(alice, globex);
  const factor = { object: 'authentication_factor', id: 'auth_factor_01ALICE', type: 'totp', totp: { issuer: 'Thermus', user: alice.email }, created_at: '2026-10-01T08:00:00.000Z', updated_at: '2026-10-01T08:00:00.000Z' };
  world.fake.answer(`GET /user_management/users/${alice.id}/auth_factors`, { status: 200, body: { object: 'list', data: [factor], list_metadata: { before: null, after: null } } });
  const before = await directory.member(targetId);
  const other = await directory.member(otherId);
  const account = await workos.userManagement.getUser(alice.id);
  const factors = (await workos.multiFactorAuth.listUserAuthFactors({ userId: alice.id })).data;
  assert.equal(before?.management, 'ordinary');
  world.fake.takeRequests();

  assert.deepEqual(await directory.deleteMembership(targetId), { outcome: 'applied' });

  assert.equal(await directory.member(targetId), undefined);
  assert.deepEqual(await directory.member(otherId), other);
  assert.deepEqual(await workos.userManagement.getUser(alice.id), account);
  assert.deepEqual((await workos.multiFactorAuth.listUserAuthFactors({ userId: alice.id })).data, factors);
  assert.deepEqual(world.fake.takeRequests().filter(({ method }) => method !== 'GET').map(({ method, path }) => ({ method, path })), [
    { method: 'DELETE', path: `/user_management/organization_memberships/${targetId}` },
  ]);
});

test('Given all current role slugs and ordinary management, when management changes without a new timestamp, then member and page facts retain all grants and external management with a new revision', async (t) => {
  const world = await WorkOSFake.start(t, hostedConfig.publicBaseUrl, [acme]);
  world.users = [alice];
  world.memberships = [{ userId: alice.id, organizationId: acme, roles: ['user', 'admin', 'member', 'super-admin'], directoryManaged: false }];
  const directory = directoryFor(world);
  const targetId = world.membershipId(alice, acme);
  const before = await directory.member(targetId);

  world.memberships = [{ ...world.memberships[0], directoryManaged: true }];
  const after = await directory.member(targetId);
  const [paged] = (await directory.memberPage({ organizationId: acme, statuses: ['active'] })).items;

  assert.equal(before?.management, 'ordinary');
  assert.equal(after?.management, 'external');
  assert.deepEqual(after?.grants.map(({ role }) => role), ['user', 'admin', 'member', 'super-admin']);
  assert.notEqual(after?.revision, before?.revision);
  assert.deepEqual(paged, after);
});

for (const answer of ['directory-managed refusal', 'response lost after deletion'] as const) {
  test(`Given ${answer}, when the directory deletes the intended membership, then it reports only the known outcome and sends one DELETE`, async (t) => {
    const world = await WorkOSFake.start(t, hostedConfig.publicBaseUrl, [acme, globex]);
    world.users = [alice];
    world.memberships = [
      { userId: alice.id, organizationId: acme, roles: ['user'], directoryManaged: answer === 'directory-managed refusal' },
      { userId: alice.id, organizationId: globex, roles: ['admin'] },
    ];
    const directory = directoryFor(world);
    const targetId = world.membershipId(alice, acme);
    const before = await directory.member(targetId);
    const otherId = world.membershipId(alice, globex);
    const other = await directory.member(otherId);
    if (answer === 'response lost after deletion') {
      world.fake.answer(`DELETE /user_management/organization_memberships/${targetId}`, () => {
        world.deletedMembershipIds.add(targetId);
        return 'close';
      });
    }
    world.fake.takeRequests();

    if (answer === 'directory-managed refusal') {
      assert.deepEqual(await directory.deleteMembership(targetId), { outcome: 'unsupported' });
      assert.deepEqual(await directory.member(targetId), before);
    } else {
      await assert.rejects(directory.deleteMembership(targetId));
      assert.equal(await directory.member(targetId), undefined);
    }

    assert.deepEqual(await directory.member(otherId), other);
    assert.deepEqual(world.fake.takeRequests().filter(({ method }) => method !== 'GET').map(({ method, path }) => ({ method, path })), [
      { method: 'DELETE', path: `/user_management/organization_memberships/${targetId}` },
    ]);
  });
}

function directoryFor(world: WorkOSFake): WorkOSOrganizations {
  const { workos, settings } = world.connection();
  return new WorkOSOrganizations({ authority: workosAuthority(settings.clientId), memberships: workosMembershipReads(workos), userManagement: workos.userManagement, authorization: workos.authorization });
}


for (const evidence of [undefined, null]) {
  test(`Given explicit ordinary management, when real membership wire evidence becomes ${String(evidence)} with the same timestamp, then member and page report unknown with a new revision`, async (t) => {
    const world = await WorkOSFake.start(t, hostedConfig.publicBaseUrl, [acme]);
    world.users = [alice];
    world.memberships = [{ userId: alice.id, organizationId: acme, roles: ['user'], directoryManaged: false }];
    const targetId = world.membershipId(alice, acme);
    const initial = membershipJson({ ...world.memberships[0], id: targetId, status: 'active', organizationName: 'Acme', changes: 0 });
    let raw: unknown = initial;
    world.fake.answer(`GET /user_management/organization_memberships/${targetId}`, () => ({ status: 200, body: raw }));
    world.fake.answer('GET /user_management/organization_memberships', () => ({ status: 200, body: { object: 'list', data: [raw], list_metadata: { before: null, after: null } } }));
    const directory = directoryFor(world);
    const before = await directory.member(targetId);
    assert.equal(before?.management, 'ordinary');

    const { directory_managed: _management, ...withoutManagement } = initial;
    raw = evidence === undefined ? withoutManagement : { ...withoutManagement, directory_managed: evidence };
    const after = await directory.member(targetId);
    const [paged] = (await directory.memberPage({ organizationId: acme, statuses: ['active'] })).items;

    assert.equal(after?.management, 'unknown');
    assert.equal(paged?.management, 'unknown');
    assert.notEqual(after?.revision, before?.revision);
    assert.deepEqual(paged, after);
  });
}
