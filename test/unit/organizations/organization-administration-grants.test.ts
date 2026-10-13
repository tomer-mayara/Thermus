import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { actorOf, administrationWith, changeOf, recordLines, rolesIn } from './fixtures/administration-fixtures.ts';

describe('OrganizationAdministration grant authority', () => {
  test('Given Super Admin alone, when it grants Admin to itself and then uses that Admin authority to grant User to itself, then each grant is applied without another person, and the User grant needs the Admin grant first', async () => {
    const { directory, records, administration } = administrationWith();
    const sam = actorOf('user-sam');

    const userFirst = await administration.changeGrant(sam, changeOf(directory, { target: 'user-sam', role: 'user', action: 'grant' }));
    const admin = await administration.changeGrant(sam, changeOf(directory, { target: 'user-sam', role: 'admin', action: 'grant' }));
    const user = await administration.changeGrant(sam, changeOf(directory, { target: 'user-sam', role: 'user', action: 'grant' }));

    assert.deepEqual([userFirst, admin, user], ['denied', 'applied', 'applied']);
    assert.deepEqual(rolesIn(directory, 'user-sam'), ['super-admin', 'admin', 'user']);
    assert.deepEqual(recordLines(records), [
      'user-sam in org-a: grant user for membership-user-sam-org-a: denied',
      'user-sam in org-a: grant admin for membership-user-sam-org-a: applied',
      'user-sam in org-a: grant user for membership-user-sam-org-a: applied',
    ]);
  });

  for (const { actor, role, label } of [
    { actor: 'user-sam', role: 'user', label: 'Super Admin alone grants or revokes User' },
    { actor: 'user-eve', role: 'admin', label: 'Admin alone grants or revokes Admin' },
    { actor: 'user-una', role: 'user', label: 'User alone grants or revokes User' },
    { actor: 'user-una', role: 'admin', label: 'User alone grants or revokes Admin' },
    { actor: 'user-otto', role: 'super-admin', label: 'a member with all three roles grants or revokes Super Admin' },
    { actor: 'user-eve', role: 'super-admin', label: 'Admin alone grants or revokes Super Admin' },
  ]) {
    test(`Given ${label}, when it asks for the change for itself and for another member, then each is denied, and the directory changes nothing`, async () => {
      const { directory, records, administration } = administrationWith();
      const outcomes = [];

      for (const target of [actor, 'user-dora', 'user-cy']) {
        for (const action of ['grant', 'revoke']) outcomes.push(await administration.changeGrant(actorOf(actor), changeOf(directory, { target, role, action })));
      }

      assert.deepEqual(outcomes, outcomes.map(() => 'denied'));
      assert.deepEqual(directory.grantChanges, []);
      assert.equal(records.length, outcomes.length);
    });
  }

  test('Given Admin plus Super Admin, when it grants Admin to another member and User to a member without a grant, then it uses each authority, and only the requested role changes', async () => {
    const { directory, administration } = administrationWith();
    const otto = actorOf('user-otto');

    const admin = await administration.changeGrant(otto, changeOf(directory, { target: 'user-una', role: 'admin', action: 'grant' }));
    const user = await administration.changeGrant(otto, changeOf(directory, { target: 'user-dora', role: 'user', action: 'grant' }));

    assert.deepEqual([admin, user], ['applied', 'applied']);
    assert.deepEqual([rolesIn(directory, 'user-una'), rolesIn(directory, 'user-dora')], [['user', 'admin'], ['user']]);
    assert.deepEqual(directory.grantChanges.map(({ role, action }) => `${action} ${role}`), ['grant admin', 'grant user']);
  });

  test('Given User plus Admin, when a Super Admin revokes Admin and an Admin then revokes User, then each removal removes only its role, and each grant of the other organization stays', async () => {
    const { directory, administration } = administrationWith();

    const admin = await administration.changeGrant(actorOf('user-sam'), changeOf(directory, { target: 'user-cy', role: 'admin', action: 'revoke' }));
    const afterAdmin = rolesIn(directory, 'user-cy');
    const user = await administration.changeGrant(actorOf('user-eve'), changeOf(directory, { target: 'user-una', role: 'user', action: 'revoke' }));

    assert.deepEqual([admin, user], ['applied', 'applied']);
    assert.deepEqual(afterAdmin, ['user']);
    assert.deepEqual(rolesIn(directory, 'user-cy', 'org-b'), ['user']);
    assert.deepEqual(rolesIn(directory, 'user-una', 'org-b'), ['user']);
  });

  test('Given User plus Admin, when the Admin revokes its own User grant, then only product access goes, and its Admin authority still works for the next change', async () => {
    const { directory, administration } = administrationWith();
    const cy = actorOf('user-cy');

    const revoked = await administration.changeGrant(cy, changeOf(directory, { target: 'user-cy', role: 'user', action: 'revoke' }));
    const next = await administration.changeGrant(cy, changeOf(directory, { target: 'user-dora', role: 'user', action: 'grant' }));

    assert.deepEqual([revoked, next], ['applied', 'applied']);
    assert.deepEqual([rolesIn(directory, 'user-cy'), rolesIn(directory, 'user-dora')], [['admin'], ['user']]);
  });

  test('Given all three roles, when the member revokes its own Admin grant, then its next User change is denied, and its retained Super Admin authority grants Admin to itself again', async () => {
    const { directory, administration } = administrationWith();
    const otto = actorOf('user-otto');

    const revoked = await administration.changeGrant(otto, changeOf(directory, { target: 'user-otto', role: 'admin', action: 'revoke' }));
    const userChange = await administration.changeGrant(otto, changeOf(directory, { target: 'user-dora', role: 'user', action: 'grant' }));
    const regranted = await administration.changeGrant(otto, changeOf(directory, { target: 'user-otto', role: 'admin', action: 'grant' }));

    assert.deepEqual([revoked, userChange, regranted], ['applied', 'denied', 'applied']);
    assert.deepEqual(rolesIn(directory, 'user-otto'), ['user', 'super-admin', 'admin']);
  });

  test('Given a member whose only application grant is User, when an Admin revokes it, then the membership stays active with only the default role, which gives no permission, and the other organization of the member stays listed', async () => {
    const { directory, administration } = administrationWith();
    const una = actorOf('user-una');

    const revoked = await administration.changeGrant(actorOf('user-eve'), changeOf(directory, { target: 'user-una', role: 'user', action: 'revoke' }));
    const organizations = await administration.listOrganizations(una.user);

    assert.equal(revoked, 'applied');
    const membership = directory.membershipIn('user-una', 'org-a');
    assert.deepEqual([membership?.status, membership?.grants], ['active', [{ role: 'member', permissions: [] }]]);
    assert.deepEqual(organizations.map(({ organizationId }) => organizationId), ['org-b']);
  });
});
