import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { InvitationOverview, OrganizationInvitation } from '../../../src/organizations/organization-administration.ts';
import { actorOf, administrationWith, recordLines } from './fixtures/administration-fixtures.ts';

function invitationsWith() {
  const served = administrationWith();
  served.directory.addInvitations(
    { organizationId: 'org-a', email: 'pending.user@example.com', role: 'user' },
    { organizationId: 'org-a', email: 'accepted.user@example.com', role: 'user', state: 'accepted' },
    { organizationId: 'org-a', email: 'revoked.user@example.com', role: 'user', state: 'revoked' },
    { organizationId: 'org-a', email: 'expired.user@example.com', role: 'user', state: 'expired' },
    { organizationId: 'org-a', email: 'pending.admin@example.com', role: 'admin' },
    { organizationId: 'org-b', email: 'globex.user@example.com', role: 'user' },
  );
  return served;
}

function overviewOf(overview: InvitationOverview | string): InvitationOverview {
  assert.notEqual(typeof overview, 'string', `the overview was refused: ${String(overview)}`);
  return overview as InvitationOverview;
}

const invitation = (organizationId: string, invitationId: string) => ({ organizationId, invitationId });

describe('OrganizationAdministration invitations', () => {
  test('Given an Admin, a Super Admin, and a member with both, when each sends invitations for each role, then each can invite only the roles of its authority, each sent invitation names only its own role, and no customer can invite Super Admin', async () => {
    const { directory, records, administration } = administrationWith();
    const outcomes: Record<string, string[]> = {};

    for (const subject of ['user-eve', 'user-sam', 'user-otto']) {
      outcomes[subject] = [];
      for (const role of ['user', 'admin', 'super-admin', 'member']) {
        outcomes[subject].push(await administration.sendInvitation(actorOf(subject), { organizationId: 'org-a', email: `${role}@example.com`, role }));
      }
    }

    assert.deepEqual(outcomes, {
      'user-eve': ['applied', 'denied', 'denied', 'denied'],
      'user-sam': ['denied', 'applied', 'denied', 'denied'],
      'user-otto': ['applied', 'applied', 'denied', 'denied'],
    });
    assert.deepEqual(directory.invitationChanges, [
      'send org-a user user@example.com',
      'send org-a admin admin@example.com',
      'send org-a user user@example.com',
      'send org-a admin admin@example.com',
    ]);
    assert.deepEqual(recordLines(records).slice(0, 4), [
      'user-eve in org-a: invite user for user@example.com: applied',
      'user-eve in org-a: invite admin for admin@example.com: denied',
      'user-eve in org-a: invite super-admin for super-admin@example.com: denied',
      'user-eve in org-a: invite member for member@example.com: denied',
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

  test('Given invitations in each state on several pages, with one repeated, when an Admin asks for the overview, then it reads each state explicitly, lists each invitation of the organization once with its state, offers changes only for pending invitations of its authority, and copies no invitation token', async () => {
    const { directory, administration } = invitationsWith();
    directory.invitationPageLayout = (invitations) => [invitations.slice(0, 3), invitations.slice(2)];

    const overview = overviewOf(await administration.invitationOverview(actorOf('user-eve'), 'org-a'));

    assert.deepEqual(overview.invitations.map(({ email, role, state, changes }) => `${email} ${role} ${state} ${changes.join('+') || '-'}`), [
      'pending.user@example.com user pending resend+revoke',
      'accepted.user@example.com user accepted -',
      'revoked.user@example.com user revoked -',
      'expired.user@example.com user expired -',
      'pending.admin@example.com admin pending -',
    ]);
    assert.deepEqual([overview.organizationId, overview.invitableRoles, overview.identityPolicy], ['org-a', ['user'], 'invited-address']);
    assert.deepEqual([...new Set(directory.invitationPageReads.map(({ states }) => states.join()))], ['pending,accepted,revoked,expired']);
    assert.doesNotMatch(JSON.stringify(overview), /token/);
    assert.ok(Object.isFrozen(overview) && Object.isFrozen(overview.invitations) && Object.isFrozen(overview.invitations[0]?.changes));
  });

  test('Given a Super Admin alone, a member with both roles, and a directory that accepts by its own rules, when each asks for the overview, then each can invite and change only the roles of its authority, and the overview gives the policy of the directory', async () => {
    const { directory, administration } = invitationsWith();
    directory.invitationIdentityPolicy = 'provider-rules';

    const sam = overviewOf(await administration.invitationOverview(actorOf('user-sam'), 'org-a'));
    const otto = overviewOf(await administration.invitationOverview(actorOf('user-otto'), 'org-a'));
    const pendingChanges = (overview: InvitationOverview) => overview.invitations.filter(({ changes }) => changes.length > 0).map(({ email }) => email);

    assert.deepEqual([sam.invitableRoles, otto.invitableRoles], [['admin'], ['user', 'admin']]);
    assert.deepEqual([pendingChanges(sam), pendingChanges(otto)], [['pending.admin@example.com'], ['pending.user@example.com', 'pending.admin@example.com']]);
    assert.deepEqual([sam.identityPolicy, otto.identityPolicy], ['provider-rules', 'provider-rules']);
  });

  test('Given an invitation page that fails or a record of another organization, when the overview is read, then a failure reaches the caller, and a record of another organization is not listed', async () => {
    const { directory, administration } = invitationsWith();
    const outage = new Error('invitation page timed out');
    directory.invitationPageLayout = () => [outage];
    await assert.rejects(administration.invitationOverview(actorOf('user-eve'), 'org-a'), outage);

    directory.invitationPageLayout = (invitations) => [[...invitations, { ...(invitations[0] as OrganizationInvitation), invitationId: 'invitation-7', organizationId: 'org-b' }]];
    const overview = overviewOf(await administration.invitationOverview(actorOf('user-eve'), 'org-a'));

    assert.equal(overview.invitations.length, 5);
  });

  for (const { label, actor, refusal } of [
    { label: 'a User without Admin or Super Admin', actor: actorOf('user-una'), refusal: 'denied' },
    { label: 'an Admin whose sign-in did not complete MFA', actor: actorOf('user-eve', false), refusal: 'mfa-required' },
  ]) {
    test(`Given ${label}, when it asks for the invitation overview, then it is refused as ${refusal}, and no invitation is read`, async () => {
      const { directory, administration } = invitationsWith();

      assert.equal(await administration.invitationOverview(actor, 'org-a'), refusal);
      assert.deepEqual(directory.invitationPageReads, []);
    });
  }
});
