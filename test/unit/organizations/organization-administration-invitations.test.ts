import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { MemberSeed } from '../../support/doubles/organizations/directory-double-records.ts';
import { memberRole } from '../../support/fixtures/hosted-roles.ts';
import { actorOf, adminGrant, administrationWith, invitationsWith, members, recordLines, userGrant } from './fixtures/administration-fixtures.ts';

const invitation = (organizationId: string, invitationId: string) => ({ organizationId, invitationId });

describe('OrganizationAdministration invitation changes', () => {
  test('Given Admin-only and combined User/Admin memberships, when each sends invitations for each role, then each can invite User or Admin, each invitation names its requested role, and retired or default roles cannot be invited', async () => {
    const { directory, records, administration } = administrationWith();
    const outcomes: Record<string, string[]> = {};

    for (const subject of ['user-eve', 'user-sam', 'user-otto']) {
      outcomes[subject] = [];
      for (const role of ['user', 'admin', 'super-admin', 'member']) {
        outcomes[subject].push(await administration.sendInvitation(actorOf(subject), { organizationId: 'org-a', email: `${role}.${subject}@example.com`, role }));
      }
    }

    assert.deepEqual(outcomes, {
      'user-eve': ['applied', 'applied', 'denied', 'denied'],
      'user-sam': ['applied', 'applied', 'denied', 'denied'],
      'user-otto': ['applied', 'applied', 'denied', 'denied'],
    });
    assert.deepEqual(directory.invitationChanges, [
      'send org-a user user.user-eve@example.com',
      'send org-a admin admin.user-eve@example.com',
      'send org-a user user.user-sam@example.com',
      'send org-a admin admin.user-sam@example.com',
      'send org-a user user.user-otto@example.com',
      'send org-a admin admin.user-otto@example.com',
    ]);
    assert.deepEqual(recordLines(records).slice(0, 4), [
      'user-eve in org-a: invite user for user.user-eve@example.com: applied',
      'user-eve in org-a: invite admin for admin.user-eve@example.com: applied',
      'user-eve in org-a: invite super-admin for super-admin.user-eve@example.com: denied',
      'user-eve in org-a: invite member for member.user-eve@example.com: denied',
    ]);
  });

  for (const { label, actor, organizationId, outcome } of [
    { label: 'a User without Admin', actor: actorOf('user-una'), organizationId: 'org-a', outcome: 'denied' },
    { label: 'an Admin of another organization', actor: actorOf('user-ben'), organizationId: 'org-a', outcome: 'denied' },
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
    await assert.rejects(administration.sendInvitation(actorOf('user-eve'), request), { name: 'UnconfirmedChangeError', cause: timeout });

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

  test('Given a pending invitation, also after an unknown send and in another letter case, when it is sent again, then the same role is unchanged, another role gives a conflict, and only a send after revocation creates a new invitation', async () => {
    const { directory, records, administration } = invitationsWith();
    directory.queue('sendInvitation', { error: new Error('invitation send timed out'), afterChange: true });
    const send = (email: string, role: string) => administration.sendInvitation(actorOf('user-otto'), { organizationId: 'org-a', email, role });

    await assert.rejects(send('new@example.com', 'user'), { name: 'UnconfirmedChangeError' });
    const outcomes = [await send('new@example.com', 'user'), await send('Pending.User@Example.com', 'user'), await send('pending.user@example.com', 'admin')];
    await administration.revokeInvitation(actorOf('user-otto'), invitation('org-a', 'invitation-1'));
    outcomes.push(await send('pending.user@example.com', 'user'));

    assert.deepEqual(outcomes, ['unchanged', 'unchanged', 'address-in-use', 'applied']);
    assert.deepEqual(directory.invitationChanges, ['send org-a user new@example.com', 'send org-a admin pending.user@example.com', 'revoke invitation-1', 'send org-a user pending.user@example.com']);
    assert.deepEqual([...new Set(directory.invitationPageReads.map(({ states }) => states.join()))], ['pending']);
    assert.deepEqual(records.map(({ outcome }) => outcome), ['unknown', 'unchanged', 'unchanged', 'address-in-use', 'applied', 'applied']);
  });

  test('Given a resend or revoke of an invitation of another organization, when it is denied, then its record names no role of that invitation', async () => {
    const { records, administration } = invitationsWith();

    await administration.revokeInvitation(actorOf('user-eve'), invitation('org-a', 'invitation-6'));
    await administration.revokeInvitation(actorOf('user-una'), invitation('org-a', 'invitation-5'));

    assert.deepEqual(recordLines(records), ['user-eve in org-a: revoke-invitation - for invitation-6: denied', 'user-una in org-a: revoke-invitation - for invitation-5: denied']);
  });
});

// Initech (org-c) is a free organization: ada, its creating Admin, and the Users bob and cid hold 3 seats. dora has only
// the default role, ivy is inactive, and pia is pending; none of them holds a seat. Hooli (org-e) is free too: its
// Admin ida and its Users jon and kim hold 3 seats.
const freeOrganizations: readonly MemberSeed[] = [
  { subject: 'user-ada', organizationId: 'org-c', grants: [adminGrant] },
  { subject: 'user-bob', organizationId: 'org-c', grants: [userGrant] },
  { subject: 'user-cid', organizationId: 'org-c', grants: [userGrant] },
  { subject: 'user-dora', organizationId: 'org-c', grants: [memberRole] },
  { subject: 'user-ivy', organizationId: 'org-c', grants: [userGrant, adminGrant], status: 'inactive' },
  { subject: 'user-pia', organizationId: 'org-c', grants: [userGrant], status: 'pending' },
  { subject: 'user-ida', organizationId: 'org-e', grants: [adminGrant] },
  { subject: 'user-jon', organizationId: 'org-e', grants: [userGrant] },
  { subject: 'user-kim', organizationId: 'org-e', grants: [userGrant] },
];

function freeAdministration() {
  const served = administrationWith([...members, ...freeOrganizations]);
  served.billing.answerWith({ plan: 'free', memberLimit: 5 });
  return served;
}

type Administration = ReturnType<typeof freeAdministration>['administration'];

function sendAs(administration: Administration, subject: string, organizationId: string) {
  return (email: string, role = 'user') => administration.sendInvitation(actorOf(subject), { organizationId, email, role });
}

// Lets every ready promise of the test process settle: the doubles answer without a timer or a socket.
const settle = () => new Promise((resolve) => setImmediate(resolve));

describe('OrganizationAdministration free member limit', () => {
  test('Given a free organization with 3 seats held by active members with product access, the creating Admin included, and a pending and an expired invitation, when an Admin sends two invitations, then the pending invitation counts and the expired one does not, so the first is applied at 4 of 5 and the second is refused with limit-reached at 5 of 5', async () => {
    const { directory, records, administration } = freeAdministration();
    directory.addInvitations({ organizationId: 'org-c', email: 'dee@example.com', role: 'user' }, { organizationId: 'org-c', email: 'old@example.com', role: 'user', state: 'expired' });
    const send = sendAs(administration, 'user-ada', 'org-c');

    const outcomes = [await send('eli@example.com'), await send('fay@example.com', 'admin')];

    assert.deepEqual(outcomes, ['applied', 'limit-reached']);
    assert.deepEqual(directory.invitationChanges, ['send org-c user eli@example.com']);
    assert.deepEqual(recordLines(records), [
      'user-ada in org-c: invite user for eli@example.com: applied',
      'user-ada in org-c: invite admin for fay@example.com: limit-reached',
    ]);
  });

  test('Given a free organization at 5 of 5 seats, when an Admin repeats a pending invitation, then it stays unchanged, while a new address is refused with limit-reached, and the count reads every active member page without a display read', async () => {
    const { directory, administration } = freeAdministration();
    directory.addInvitations({ organizationId: 'org-c', email: 'dee@example.com', role: 'user' }, { organizationId: 'org-c', email: 'eli@example.com', role: 'user' });
    const send = sendAs(administration, 'user-ada', 'org-c');

    const outcomes = [await send('Dee@Example.com'), await send('fay@example.com')];

    assert.deepEqual(outcomes, ['unchanged', 'limit-reached']);
    assert.deepEqual(directory.invitationChanges, []);
    assert.deepEqual([...new Set(directory.memberFactsPageReads.map(({ organizationId, statuses }) => `${organizationId} ${statuses.join()}`))], ['org-c active']);
    assert.ok(directory.memberFactsPageReads.some(({ cursor }) => cursor !== undefined), 'The count read each member page.');
    assert.deepEqual(directory.memberPageReads, []);
  });

  for (const { label, fail } of [
    { label: 'a member page', fail: (served: ReturnType<typeof freeAdministration>, cause: Error) => { served.directory.memberFactsPageLayout = (facts) => [facts.slice(0, 2), cause]; } },
    { label: 'an invitation page', fail: (served: ReturnType<typeof freeAdministration>, cause: Error) => { served.directory.invitationPageLayout = () => [cause]; } },
    { label: 'the billing read', fail: (served: ReturnType<typeof freeAdministration>, cause: Error) => { served.billing.failWith(cause); } },
  ]) {
    test(`Given ${label} that fails at 3 of 5 seats, when an Admin invites, then the failure reaches the caller, nothing is sent, and the record keeps failed`, async () => {
      const served = freeAdministration();
      const cause = new Error(`${label} timed out`);
      fail(served, cause);

      await assert.rejects(sendAs(served.administration, 'user-ada', 'org-c')('eli@example.com'), cause);

      assert.deepEqual(served.directory.invitationChanges, []);
      assert.deepEqual(recordLines(served.records), ['user-ada in org-c: invite user for eli@example.com: failed']);
    });
  }

  test('Given a free organization with 3 active members and 1 pending invitation, 4 of 5 seats, when two Admins send at the same time while the directory holds the first send, then the second check waits for that send, so one invitation is applied and the other is refused with limit-reached', async () => {
    const { directory, records, administration } = freeAdministration();
    directory.addMembers(
      { subject: 'user-ann', organizationId: 'org-d', grants: [adminGrant] },
      { subject: 'user-art', organizationId: 'org-d', grants: [userGrant, adminGrant] },
      { subject: 'user-bea', organizationId: 'org-d', grants: [userGrant] },
    );
    directory.addInvitations({ organizationId: 'org-d', email: 'dee@example.com', role: 'user' });
    const release = directory.holdChanges();

    const sends = [sendAs(administration, 'user-ann', 'org-d')('eli@example.com'), sendAs(administration, 'user-art', 'org-d')('fay@example.com', 'admin')];
    await settle();
    const whileHeld = [...directory.invitationChanges];
    release();
    const outcomes = await Promise.all(sends);

    assert.deepEqual(whileHeld, ['send org-d user eli@example.com']);
    assert.deepEqual(outcomes, ['applied', 'limit-reached']);
    assert.deepEqual(directory.invitationChanges, ['send org-d user eli@example.com']);
    assert.deepEqual(recordLines(records), [
      'user-ann in org-d: invite user for eli@example.com: applied',
      'user-art in org-d: invite admin for fay@example.com: limit-reached',
    ]);
  });

  test('Given two free organizations, when the send of one waits in the directory, then a send of the other reaches the directory at once, and a failed send releases its organization for the next send', async () => {
    const { directory, administration } = freeAdministration();
    directory.queue('sendInvitation', { error: new Error('invitation send timed out') });
    const release = directory.holdChanges();

    const held = sendAs(administration, 'user-ada', 'org-c')('eli@example.com');
    const other = sendAs(administration, 'user-ida', 'org-e')('new.e@example.com');
    await settle();
    const whileHeld = [...directory.invitationChanges];
    release();
    await assert.rejects(held, { name: 'UnconfirmedChangeError' });
    const outcomes = [await other, await sendAs(administration, 'user-ada', 'org-c')('fay@example.com')];

    assert.deepEqual(whileHeld, ['send org-c user eli@example.com', 'send org-e user new.e@example.com']);
    assert.deepEqual(outcomes, ['applied', 'applied']);
  });

  test('Given a team organization with 5 seats and a pending invitation, when an Admin invites, then no member limit applies and the invitation is applied without a member read', async () => {
    const { directory, billing, administration } = invitationsWith();

    const outcome = await sendAs(administration, 'user-eve', 'org-a')('new@example.com');

    assert.equal(outcome, 'applied');
    assert.deepEqual(billing.stateReads, ['org-a']);
    assert.deepEqual([directory.memberFactsPageReads, directory.memberPageReads], [[], []]);
  });
});
