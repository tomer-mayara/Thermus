import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { MemberSeed } from '../../support/doubles/organizations/directory-double-records.ts';
import { actorOf, administrationWith, invitationsWith, members, superAdminGrant, userGrant } from './fixtures/administration-fixtures.ts';

// vic is an inactive Super Admin of Acme. gil is a Super Admin of Globex, the organization that each session of the
// fixtures selected, and only a User in Acme.
const billingMembers: readonly MemberSeed[] = [
  ...members,
  { subject: 'user-vic', organizationId: 'org-a', grants: [superAdminGrant], status: 'inactive' },
  { subject: 'user-gil', organizationId: 'org-b', grants: [superAdminGrant] },
  { subject: 'user-gil', organizationId: 'org-a', grants: [userGrant] },
];

describe('OrganizationAdministration billing state', () => {
  for (const subject of ['user-sam', 'user-otto']) {
    test(`Given a Super Admin (${subject}) whose sign-in completed MFA and whose session selected Globex, when it asks for the billing state of Acme, then a current read of its memberships authorizes it, and it gets the state of Acme from billing`, async () => {
      const { directory, records, billing, administration } = administrationWith();
      const actor = actorOf(subject);

      const state = await administration.billingState(actor, 'org-a');

      assert.deepEqual(state, { organizationId: 'org-a', plan: 'free', billedSeats: 0 });
      assert.ok(Object.isFrozen(state));
      assert.deepEqual(directory.membershipReads, [actor.user]);
      assert.deepEqual(billing.stateReads, ['org-a']);
      assert.deepEqual([billing.seatUpdates, records], [[], []]);
    });
  }

  test('Given a Super Admin whose sign-in did not complete MFA, when it asks for the billing state, then MFA is required before any read: no membership is read, and billing reads nothing', async () => {
    const { directory, billing, administration } = administrationWith();

    const state = await administration.billingState(actorOf('user-sam', false), 'org-a');

    assert.equal(state, 'mfa-required');
    assert.deepEqual([directory.membershipReads, billing.stateReads], [[], []]);
  });

  for (const { label, subject } of [
    { label: 'a User alone', subject: 'user-una' },
    { label: 'an Admin alone', subject: 'user-eve' },
    { label: 'User plus Admin', subject: 'user-cy' },
    { label: 'a member with only the default role', subject: 'user-dora' },
    { label: 'a Super Admin whose membership is inactive', subject: 'user-vic' },
    { label: 'a Super Admin of the selected organization of the session that is only a User in Acme', subject: 'user-gil' },
  ]) {
    test(`Given ${label}, when it asks for the billing state of Acme, then a current read of its memberships denies it, and billing reads nothing`, async () => {
      const { directory, billing, administration } = administrationWith(billingMembers);
      const actor = actorOf(subject);

      const state = await administration.billingState(actor, 'org-a');

      assert.equal(state, 'denied');
      assert.deepEqual(directory.membershipReads, [actor.user]);
      assert.deepEqual(billing.stateReads, []);
    });
  }

  test('Given a membership read that fails, when a Super Admin asks for the billing state, then the failure reaches the caller unchanged, and billing reads nothing', async () => {
    const { directory, billing, administration } = administrationWith();
    const outage = new Error('organization directory timed out');
    directory.failMembershipReads(outage);

    await assert.rejects(administration.billingState(actorOf('user-sam'), 'org-a'), outage);

    assert.deepEqual(billing.stateReads, []);
  });

  test('Given a billing read that fails, when a Super Admin asks for the billing state, then the failure reaches the caller unchanged', async () => {
    const { billing, administration } = administrationWith();
    const outage = new Error('billing read timed out');
    billing.failWith(outage);

    await assert.rejects(administration.billingState(actorOf('user-sam'), 'org-a'), outage);

    assert.deepEqual(billing.stateReads, ['org-a']);
  });
});


// The number of change records that were kept when each seat update of billing started.
describe('OrganizationAdministration invitation billing behavior', () => {
  test('Given an Admin, when it sends, resends, and revokes User invitations, then each is applied, and billing gets no update, because an invitation is no seat', async () => {
    const { billing, administration } = invitationsWith();
    const eve = actorOf('user-eve');

    const outcomes = [
      await administration.sendInvitation(eve, { organizationId: 'org-a', email: 'new@example.com', role: 'user' }),
      await administration.resendInvitation(eve, { organizationId: 'org-a', invitationId: 'invitation-1' }),
      await administration.revokeInvitation(eve, { organizationId: 'org-a', invitationId: 'invitation-1' }),
    ];

    assert.deepEqual(outcomes, ['applied', 'applied', 'applied']);
    assert.deepEqual(billing.seatUpdates, []);
  });

});
