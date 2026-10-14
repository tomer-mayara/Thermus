import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { actorOf, administrationWith, invitationsWith, recordLines } from './fixtures/administration-fixtures.ts';

const invitation = (organizationId: string, invitationId: string) => ({ organizationId, invitationId });

describe('OrganizationAdministration invitation changes', () => {
  test('Given an Admin, a Super Admin, and a member with both, when each sends invitations for each role, then each can invite only the roles of its authority, each sent invitation names only its own role, and no customer can invite Super Admin', async () => {
    const { directory, records, administration } = administrationWith();
    const outcomes: Record<string, string[]> = {};

    for (const subject of ['user-eve', 'user-sam', 'user-otto']) {
      outcomes[subject] = [];
      for (const role of ['user', 'admin', 'super-admin', 'member']) {
        outcomes[subject].push(await administration.sendInvitation(actorOf(subject), { organizationId: 'org-a', email: `${role}.${subject}@example.com`, role }));
      }
    }

    assert.deepEqual(outcomes, {
      'user-eve': ['applied', 'denied', 'denied', 'denied'],
      'user-sam': ['denied', 'applied', 'denied', 'denied'],
      'user-otto': ['applied', 'applied', 'denied', 'denied'],
    });
    assert.deepEqual(directory.invitationChanges, [
      'send org-a user user.user-eve@example.com',
      'send org-a admin admin.user-sam@example.com',
      'send org-a user user.user-otto@example.com',
      'send org-a admin admin.user-otto@example.com',
    ]);
    assert.deepEqual(recordLines(records).slice(0, 4), [
      'user-eve in org-a: invite user for user.user-eve@example.com: applied',
      'user-eve in org-a: invite admin for admin.user-eve@example.com: denied',
      'user-eve in org-a: invite super-admin for super-admin.user-eve@example.com: denied',
      'user-eve in org-a: invite member for member.user-eve@example.com: denied',
    ]);
  });

  for (const { label, actor, organizationId, outcome } of [
    { label: 'a User without Admin', actor: actorOf('user-una'), organizationId: 'org-a', outcome: 'denied' },
    { label: 'an Admin of another organization', actor: actorOf('user-ben'), organizationId: 'org-a', outcome: 'denied' },
    { label: 'an Admin whose sign-in did not complete MFA', actor: actorOf('user-eve', false), organizationId: 'org-a', outcome: 'mfa-required' },
  ]) {
    test(`Given ${label}, when it sends a User invitation, then it is refused as ${outcome}, nothing is sent, and the refusal is recorded`, async () => {
      const { directory, records, administration } = administrationWith();

      const sent = await administration.sendInvitation(actor, { organizationId, email: 'new@example.com', role: 'user' });

      assert.equal(sent, outcome);
      assert.deepEqual(directory.invitationChanges, []);
      assert.deepEqual(records.map(({ outcome: recorded }) => recorded), [outcome]);
    });
  }

  test('Given a directory that cannot send an invitation safely, or that fails while it sends one, when an Admin sends an invitation, then the first is refused as unsupported and the second is recorded as unknown and reaches the caller', async () => {
    const { directory, records, administration } = administrationWith();
    const timeout = new Error('invitation send timed out');
    directory.queue('sendInvitation', { result: 'unsupported' }, { error: timeout, afterChange: true });
    const request = { organizationId: 'org-a', email: 'new@example.com', role: 'user' };

    const unsupported = await administration.sendInvitation(actorOf('user-eve'), request);
    await assert.rejects(administration.sendInvitation(actorOf('user-eve'), request), timeout);

    assert.equal(unsupported, 'unsupported');
    assert.deepEqual(records.map(({ outcome }) => outcome), ['unsupported', 'unknown']);
  });

  test('Given a directory that refuses the address of an invitation, because it belongs to a member or has a pending invitation for another role, when an Admin sends the invitation, then the result is address-in-use, and the record keeps that outcome', async () => {
    const { directory, records, administration } = administrationWith();
    directory.queue('sendInvitation', { result: 'address-in-use' });

    const sent = await administration.sendInvitation(actorOf('user-eve'), { organizationId: 'org-a', email: 'member@example.com', role: 'user' });

    assert.equal(sent, 'address-in-use');
    assert.deepEqual(recordLines(records), ['user-eve in org-a: invite user for member@example.com: address-in-use']);
  });

  test('Given a pending User invitation, when an Admin resends and then revokes it, then each is applied once, and a second resend or revoke finds it no longer pending without a directory change', async () => {
    const { directory, records, administration } = invitationsWith();
    const eve = actorOf('user-eve');

    const outcomes = [
      await administration.resendInvitation(eve, invitation('org-a', 'invitation-1')),
      await administration.revokeInvitation(eve, invitation('org-a', 'invitation-1')),
      await administration.resendInvitation(eve, invitation('org-a', 'invitation-1')),
      await administration.revokeInvitation(eve, invitation('org-a', 'invitation-1')),
    ];

    assert.deepEqual(outcomes, ['applied', 'applied', 'not-pending', 'not-pending']);
    assert.deepEqual(directory.invitationChanges, ['resend invitation-1', 'revoke invitation-1']);
    assert.deepEqual(recordLines(records), [
      'user-eve in org-a: resend-invitation user for invitation-1: applied',
      'user-eve in org-a: revoke-invitation user for invitation-1: applied',
      'user-eve in org-a: resend-invitation user for invitation-1: not-pending',
      'user-eve in org-a: revoke-invitation user for invitation-1: not-pending',
    ]);
  });

  for (const { label, actor, target, outcome } of [
    { label: 'an accepted invitation', actor: 'user-eve', target: invitation('org-a', 'invitation-2'), outcome: 'not-pending' },
    { label: 'an expired invitation', actor: 'user-eve', target: invitation('org-a', 'invitation-4'), outcome: 'not-pending' },
    { label: 'an Admin invitation, by an Admin', actor: 'user-eve', target: invitation('org-a', 'invitation-5'), outcome: 'denied' },
    { label: 'a User invitation, by a Super Admin alone', actor: 'user-sam', target: invitation('org-a', 'invitation-1'), outcome: 'denied' },
    { label: 'an invitation of another organization', actor: 'user-eve', target: invitation('org-a', 'invitation-6'), outcome: 'denied' },
    { label: 'an unknown invitation', actor: 'user-eve', target: invitation('org-a', 'invitation-99'), outcome: 'denied' },
    { label: 'an invitation, by a User without Admin', actor: 'user-una', target: invitation('org-a', 'invitation-1'), outcome: 'denied' },
  ]) {
    test(`Given ${label}, when the actor resends or revokes it, then each is refused as ${outcome}, and the directory changes nothing`, async () => {
      const { directory, records, administration } = invitationsWith();

      const outcomes = [await administration.resendInvitation(actorOf(actor), target), await administration.revokeInvitation(actorOf(actor), target)];

      assert.deepEqual(outcomes, [outcome, outcome]);
      assert.deepEqual(directory.invitationChanges, []);
      assert.equal(records.length, 2);
    });
  }

  test('Given an invitation that the invited person accepts after the service read it as pending, when the directory refuses the revoke, then the revoke is not pending, and the acceptance stays', async () => {
    const { directory, administration } = invitationsWith();
    const read = directory.invitation.bind(directory);
    directory.invitation = async (invitationId) => {
      const pending = await read(invitationId);
      directory.acceptInvitation(invitationId, 'user-new');
      return pending;
    };

    const outcome = await administration.revokeInvitation(actorOf('user-eve'), invitation('org-a', 'invitation-1'));

    assert.equal(outcome, 'not-pending');
    assert.deepEqual(directory.invitationChanges, ['revoke invitation-1']);
    assert.equal(directory.membershipIn('user-new', 'org-a')?.status, 'active');
  });

  test('Given a pending invitation to an address for a role, also as a retry after an unknown outcome and in another letter case, when it is sent again, then nothing is sent and the outcome is unchanged; another role, or a send after the invitation was revoked, is sent', async () => {
    const { directory, records, administration } = invitationsWith();
    directory.queue('sendInvitation', { error: new Error('invitation send timed out'), afterChange: true });
    const send = (email: string, role: string) => administration.sendInvitation(actorOf('user-otto'), { organizationId: 'org-a', email, role });

    await assert.rejects(send('new@example.com', 'user'), /timed out/);
    const outcomes = [await send('new@example.com', 'user'), await send('Pending.User@Example.com', 'user'), await send('pending.user@example.com', 'admin')];
    await administration.revokeInvitation(actorOf('user-otto'), invitation('org-a', 'invitation-1'));
    outcomes.push(await send('pending.user@example.com', 'user'));

    assert.deepEqual(outcomes, ['unchanged', 'unchanged', 'applied', 'applied']);
    assert.deepEqual(directory.invitationChanges, ['send org-a user new@example.com', 'send org-a admin pending.user@example.com', 'revoke invitation-1', 'send org-a user pending.user@example.com']);
    assert.deepEqual([...new Set(directory.invitationPageReads.map(({ states }) => states.join()))], ['pending']);
    assert.deepEqual(records.map(({ outcome }) => outcome), ['unknown', 'unchanged', 'unchanged', 'applied', 'applied', 'applied']);
  });

  test('Given a resend or revoke of an invitation of another organization, when it is denied, then its record names no role of that invitation', async () => {
    const { records, administration } = invitationsWith();

    await administration.revokeInvitation(actorOf('user-eve'), invitation('org-a', 'invitation-6'));
    await administration.revokeInvitation(actorOf('user-eve'), invitation('org-a', 'invitation-5'));

    assert.deepEqual(recordLines(records), ['user-eve in org-a: revoke-invitation - for invitation-6: denied', 'user-eve in org-a: revoke-invitation admin for invitation-5: denied']);
  });
});
