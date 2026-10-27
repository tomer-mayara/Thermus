import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { InvitationOverview } from '../../../src/accounts/organizations/administration-overviews.ts';
import type { MemberSeed } from '../../support/doubles/organizations/directory-double-records.ts';
import { memberRole } from '../../support/fixtures/hosted-roles.ts';
import { actorOf, adminGrant, administrationWith, invitationsWith, members, recordLines, userGrant } from './fixtures/administration-fixtures.ts';

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

function overviewOf(overview: InvitationOverview | string): InvitationOverview {
  assert.notEqual(typeof overview, 'string', `the overview was refused: ${String(overview)}`);
  return overview as InvitationOverview;
}

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

  test('Given a team organization with 5 active members with product access and 2 pending invitations, when an Admin invites, then no member limit applies and the invitation is applied without a member read', async () => {
    const { directory, billing, administration } = invitationsWith();

    const outcome = await sendAs(administration, 'user-eve', 'org-a')('new@example.com');

    assert.equal(outcome, 'applied');
    assert.deepEqual(billing.stateReads, ['org-a']);
    assert.deepEqual([directory.memberFactsPageReads, directory.memberPageReads], [[], []]);
  });

  test('Given a free organization above its limit after a downgrade and a team organization, when an Admin reads each invitation overview, then the free one has its seats, 5 active members with product access and 2 pending invitations of the limit 5, and the team one has none', async () => {
    const free = invitationsWith();
    free.billing.answerWith({ plan: 'free', memberLimit: 5 });
    const team = invitationsWith();

    const freeOverview = overviewOf(await free.administration.invitationOverview(actorOf('user-eve'), 'org-a'));
    const teamOverview = overviewOf(await team.administration.invitationOverview(actorOf('user-eve'), 'org-a'));

    assert.deepEqual(freeOverview.seats, { used: 7, limit: 5 });
    assert.ok(Object.isFrozen(freeOverview) && Object.isFrozen(freeOverview.seats));
    assert.equal(teamOverview.seats, undefined);
    assert.deepEqual([free.billing.stateReads, team.billing.stateReads], [['org-a'], ['org-a']]);
    assert.deepEqual([free.directory.memberPageReads, team.directory.memberFactsPageReads], [[], []]);
  });

  test('Given a member page that fails in a free organization, when an Admin reads the invitation overview, then the failure reaches the caller and no partial seat count exists', async () => {
    const { directory, billing, administration } = invitationsWith();
    billing.answerWith({ plan: 'free', memberLimit: 5 });
    const outage = new Error('member page 2 timed out');
    directory.memberFactsPageLayout = (facts) => [facts.slice(0, 2), outage];

    await assert.rejects(administration.invitationOverview(actorOf('user-eve'), 'org-a'), outage);
  });
});
