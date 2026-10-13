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

  test('Given an Admin and a combined-role member, when the Admin asks to revoke its Admin or Super Admin grant, or to deactivate, disable, reset, or remove the member, also with an unknown or empty role or action, then each is denied before the target is read, and no grant changes', async () => {
    const { directory, records, administration } = administrationWith();
    const eve = actorOf('user-eve');
    const requests = [
      { target: 'user-cy', role: 'admin', action: 'revoke' },
      { target: 'user-otto', role: 'super-admin', action: 'revoke' },
      { target: 'user-cy', role: 'user', action: 'deactivate' },
      { target: 'user-cy', role: 'user', action: 'disable' },
      { target: 'user-cy', role: 'user', action: 'reset-credentials' },
      { target: 'user-cy', role: 'user', action: 'remove' },
      { target: 'user-cy', role: 'member', action: 'grant' },
      { target: 'user-cy', role: '', action: 'revoke' },
      { target: 'user-cy', role: 'user', action: '' },
      { target: 'user-cy', role: 'USER', action: 'REVOKE' },
    ];

    const outcomes = [];
    for (const request of requests) outcomes.push(await administration.changeGrant(eve, changeOf(directory, request)));

    assert.deepEqual(outcomes, requests.map(() => 'denied'));
    assert.deepEqual([directory.memberReads, directory.grantChanges], [[], []]);
    assert.deepEqual([rolesIn(directory, 'user-cy'), rolesIn(directory, 'user-otto')], [['user', 'admin'], ['user', 'admin', 'super-admin']]);
    assert.deepEqual(recordLines(records).slice(2, 4), [
      'user-eve in org-a: deactivate user for membership-user-cy-org-a: denied',
      'user-eve in org-a: disable user for membership-user-cy-org-a: denied',
    ]);
  });

  for (const { label, actor, change } of [
    { label: 'a target membership of another organization', actor: 'user-ben', change: { target: 'user-cy', role: 'user', action: 'revoke', organizationId: 'org-b', targetOrganizationId: 'org-a' } },
    { label: 'an organization where the actor has no membership', actor: 'user-ben', change: { target: 'user-una', role: 'user', action: 'revoke', organizationId: 'org-a' } },
    { label: 'an organization where the actor has only User', actor: 'user-cy', change: { target: 'user-una', role: 'user', action: 'revoke', organizationId: 'org-b' } },
    { label: 'an actor whose membership is inactive', actor: 'user-ivy', change: { target: 'user-una', role: 'user', action: 'revoke' } },
    { label: 'an unknown target membership', actor: 'user-eve', change: { target: 'user-nobody', role: 'user', action: 'grant' } },
    { label: 'an inactive target membership', actor: 'user-eve', change: { target: 'user-ivy', role: 'user', action: 'revoke' } },
    { label: 'a pending target membership', actor: 'user-eve', change: { target: 'user-pia', role: 'user', action: 'revoke' } },
  ]) {
    test(`Given ${label}, when an actor asks for a grant change, then it is denied, and no grant changes`, async () => {
      const { directory, records, administration } = administrationWith();

      const outcome = await administration.changeGrant(actorOf(actor), changeOf(directory, change));

      assert.equal(outcome, 'denied');
      assert.deepEqual(directory.grantChanges, []);
      assert.deepEqual(records.map(({ outcome: recorded }) => recorded), ['denied']);
    });
  }

  test('Given an Admin whose Admin grant was revoked after its last change, when it asks for the next change, then the current read denies it', async () => {
    const { directory, administration } = administrationWith();
    const eve = actorOf('user-eve');

    const first = await administration.changeGrant(eve, changeOf(directory, { target: 'user-dora', role: 'user', action: 'grant' }));
    await administration.changeGrant(actorOf('user-sam'), changeOf(directory, { target: 'user-eve', role: 'admin', action: 'revoke' }));
    const next = await administration.changeGrant(eve, changeOf(directory, { target: 'user-dora', role: 'user', action: 'revoke' }));

    assert.deepEqual([first, next], ['applied', 'denied']);
    assert.deepEqual(rolesIn(directory, 'user-dora'), ['user']);
  });

  test('Given an actor whose sign-in did not complete MFA, also a Super Admin, when it asks for a grant change, then MFA is required, no membership is read, and no grant changes', async () => {
    const { directory, records, administration } = administrationWith();

    const outcomes = [
      await administration.changeGrant(actorOf('user-eve', false), changeOf(directory, { target: 'user-dora', role: 'user', action: 'grant' })),
      await administration.changeGrant(actorOf('user-otto', false), changeOf(directory, { target: 'user-otto', role: 'admin', action: 'revoke' })),
    ];

    assert.deepEqual(outcomes, ['mfa-required', 'mfa-required']);
    assert.deepEqual([directory.membershipReads, directory.memberReads, directory.grantChanges], [[], [], []]);
    assert.deepEqual(recordLines(records), [
      'user-eve in org-a: grant user for membership-user-dora-org-a: mfa-required',
      'user-otto in org-a: revoke admin for membership-user-otto-org-a: mfa-required',
    ]);
  });

  test('Given a target that already has the role or lacks it, when an authorized actor grants or revokes it, then the outcome is unchanged, and the directory changes nothing', async () => {
    const { directory, administration } = administrationWith();
    const eve = actorOf('user-eve');

    const outcomes = [
      await administration.changeGrant(eve, changeOf(directory, { target: 'user-una', role: 'user', action: 'grant' })),
      await administration.changeGrant(eve, changeOf(directory, { target: 'user-eve', role: 'user', action: 'revoke' })),
    ];

    assert.deepEqual(outcomes, ['unchanged', 'unchanged']);
    assert.deepEqual(directory.grantChanges, []);
  });

  test('Given an authorized change, when it is applied, then the directory gets one change of one role, with the revision that the actor saw, and the record holds only the contract fields', async () => {
    const { directory, records, administration } = administrationWith();
    const request = changeOf(directory, { target: 'user-dora', role: 'user', action: 'grant' });

    await administration.changeGrant(actorOf('user-eve'), request);

    assert.deepEqual(directory.grantChanges, [{ membershipId: 'membership-user-dora-org-a', role: 'user', action: 'grant', revision: 'r1' }]);
    assert.deepEqual(records, [{
      time: '2026-10-13T12:00:00.000Z',
      actor: { authority: 'hosted-provider-double', subject: 'user-eve' },
      organizationId: 'org-a',
      target: { membershipId: 'membership-user-dora-org-a' },
      action: 'grant',
      role: 'user',
      outcome: 'applied',
    }]);
  });
});
