import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { GrantChangeRequest } from '../../../src/organizations/organization-administration.ts';
import { actorOf, adminGrant, administrationWith, changeOf, invitationsWith, members, recordLines, rolesIn, superAdminGrant, userGrant } from './fixtures/administration-fixtures.ts';
import { memberRole, type MemberSeed } from './fixtures/directory-double-records.ts';

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

type Served = ReturnType<typeof administrationWith>;

// The number of change records that were kept when each seat update of billing started.
function recordsAtEachUpdate({ billing, records }: Served): readonly number[] {
  const counts: number[] = [];
  const update = billing.updateSeats.bind(billing);
  billing.updateSeats = (organizationId, seatCount) => {
    counts.push(records.length);
    return update(organizationId, seatCount);
  };
  return counts;
}

describe('OrganizationAdministration seat updates of billing', () => {
  test('Given Acme with 3 active User seats on overlapping pages that repeat members, when an Admin grants User to a member and another Admin revokes User from a member, then billing gets the complete count after each applied change, 4 and then 3, one update for each change, each after its record is kept', async () => {
    const served = administrationWith();
    const { directory, records, billing, administration } = served;
    directory.memberPageLayout = (pages) => [pages.slice(0, 3), pages.slice(2, 6), pages.slice(5)];
    const recordsAtUpdates = recordsAtEachUpdate(served);

    const granted = await administration.changeGrant(actorOf('user-eve'), changeOf(directory, { target: 'user-dora', role: 'user', action: 'grant' }));
    const revoked = await administration.changeGrant(actorOf('user-cy'), changeOf(directory, { target: 'user-una', role: 'user', action: 'revoke' }));

    assert.deepEqual([granted, revoked], ['applied', 'applied']);
    assert.deepEqual(billing.seatUpdates, ['org-a: 4', 'org-a: 3']);
    assert.deepEqual(recordsAtUpdates, [1, 2]);
    assert.deepEqual(billing.stateReads, []);
    assert.deepEqual(recordLines(records), [
      'user-eve in org-a: grant user for membership-user-dora-org-a: applied',
      'user-cy in org-a: revoke user for membership-user-una-org-a: applied',
    ]);
  });

  test('Given only Admin-only, Super-Admin-only, default-role, pending, and inactive memberships, the last two with User, when an Admin grants User to the default-role member, then billing gets the count 1, because only that membership is active with User', async () => {
    const { directory, billing, administration } = administrationWith([
      { subject: 'user-sam', organizationId: 'org-a', grants: [superAdminGrant] },
      { subject: 'user-eve', organizationId: 'org-a', grants: [adminGrant] },
      { subject: 'user-dora', organizationId: 'org-a', grants: [memberRole] },
      { subject: 'user-pia', organizationId: 'org-a', grants: [userGrant], status: 'pending' },
      { subject: 'user-ivy', organizationId: 'org-a', grants: [userGrant, adminGrant], status: 'inactive' },
      { subject: 'user-una', organizationId: 'org-b', grants: [userGrant] },
    ]);

    const outcome = await administration.changeGrant(actorOf('user-eve'), changeOf(directory, { target: 'user-dora', role: 'user', action: 'grant' }));

    assert.equal(outcome, 'applied');
    assert.deepEqual(billing.seatUpdates, ['org-a: 1']);
  });

  test('Given a Super Admin, when it grants Admin to a User and revokes Admin from User plus Admin, then each change is applied, and billing gets no update, because only a User change changes the count', async () => {
    const { directory, billing, administration } = administrationWith();
    const sam = actorOf('user-sam');

    const outcomes = [
      await administration.changeGrant(sam, changeOf(directory, { target: 'user-una', role: 'admin', action: 'grant' })),
      await administration.changeGrant(sam, changeOf(directory, { target: 'user-cy', role: 'admin', action: 'revoke' })),
    ];

    assert.deepEqual(outcomes, ['applied', 'applied']);
    assert.deepEqual(billing.seatUpdates, []);
  });

  for (const { label, outcome, prepare } of [
    { label: 'a target that already has User', outcome: 'unchanged', prepare: (served: Served) => ({ subject: 'user-eve', request: changeOf(served.directory, { target: 'user-una', role: 'user', action: 'grant' }) }) },
    { label: 'a User without Admin as the actor', outcome: 'denied', prepare: (served: Served) => ({ subject: 'user-una', request: changeOf(served.directory, { target: 'user-dora', role: 'user', action: 'grant' }) }) },
    { label: 'a form with an older revision', outcome: 'stale', prepare: (served: Served) => ({ subject: 'user-eve', request: { ...changeOf(served.directory, { target: 'user-dora', role: 'user', action: 'grant' }), revision: 'r0' } }) },
    {
      label: 'a directory that answers stale',
      outcome: 'stale',
      prepare: (served: Served) => {
        served.directory.queue('changeGrant', { result: 'stale' });
        return { subject: 'user-eve', request: changeOf(served.directory, { target: 'user-dora', role: 'user', action: 'grant' }) };
      },
    },
    {
      label: 'a directory that cannot make the change safely',
      outcome: 'unsupported',
      prepare: (served: Served) => {
        served.directory.queue('changeGrant', { result: 'unsupported' });
        return { subject: 'user-eve', request: changeOf(served.directory, { target: 'user-dora', role: 'user', action: 'grant' }) };
      },
    },
  ] satisfies ReadonlyArray<{ label: string; outcome: string; prepare: (served: Served) => { subject: string; request: GrantChangeRequest } }>) {
    test(`Given ${label}, when a User grant change runs, then it is ${outcome}, and billing gets no update`, async () => {
      const served = administrationWith();
      const { subject, request } = prepare(served);

      const result = await served.administration.changeGrant(actorOf(subject), request);

      assert.equal(result, outcome);
      assert.deepEqual(served.billing.seatUpdates, []);
    });
  }

  test('Given an Admin whose sign-in did not complete MFA, when it asks for a User grant change, then MFA is required, and billing gets no update', async () => {
    const { directory, billing, administration } = administrationWith();

    const outcome = await administration.changeGrant(actorOf('user-eve', false), changeOf(directory, { target: 'user-dora', role: 'user', action: 'grant' }));

    assert.equal(outcome, 'mfa-required');
    assert.deepEqual(billing.seatUpdates, []);
  });

  test('Given a directory change that fails after its effect, when a User grant change runs, then the failure reaches the caller, the record says unknown, and billing gets no update', async () => {
    const { directory, records, billing, administration } = administrationWith();
    const timeout = new Error('directory change timed out');
    directory.queue('changeGrant', { error: timeout, afterChange: true });

    await assert.rejects(administration.changeGrant(actorOf('user-eve'), changeOf(directory, { target: 'user-dora', role: 'user', action: 'grant' })), timeout);

    assert.deepEqual(recordLines(records), ['user-eve in org-a: grant user for membership-user-dora-org-a: unknown']);
    assert.deepEqual(billing.seatUpdates, []);
  });

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

  test('Given a member page that fails while the count is read after an applied User grant, when the change runs, then the page error reaches the caller, billing gets no partial count, and the change stays applied with its one record', async () => {
    const { directory, records, billing, administration } = administrationWith();
    const request = changeOf(directory, { target: 'user-dora', role: 'user', action: 'grant' });
    const outage = new Error('member page 2 timed out');
    directory.memberPageLayout = (pages) => [pages.slice(0, 2), outage, pages.slice(4)];

    await assert.rejects(administration.changeGrant(actorOf('user-eve'), request), outage);

    assert.deepEqual(billing.seatUpdates, []);
    assert.deepEqual(rolesIn(directory, 'user-dora'), ['user']);
    assert.deepEqual(recordLines(records), ['user-eve in org-a: grant user for membership-user-dora-org-a: applied']);
  });

  test('Given billing that rejects a seat update, when an applied User grant gives it the count, then the rejection reaches the caller with its cause, and the change stays applied with its one record', async () => {
    const { directory, records, billing, administration } = administrationWith();
    const outage = new Error('billing update timed out');
    billing.failWith(outage);

    await assert.rejects(administration.changeGrant(actorOf('user-eve'), changeOf(directory, { target: 'user-dora', role: 'user', action: 'grant' })), outage);

    assert.deepEqual(billing.seatUpdates, ['org-a: 4']);
    assert.deepEqual(rolesIn(directory, 'user-dora'), ['user']);
    assert.deepEqual(recordLines(records), ['user-eve in org-a: grant user for membership-user-dora-org-a: applied']);
  });
});
