import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { InvitationOverview } from '../../../src/accounts/organizations/administration-overviews.ts';
import type { OrganizationInvitation } from '../../../src/accounts/organizations/organization-directory.ts';
import { actorOf, invitationsWith } from './fixtures/administration-fixtures.ts';

function overviewOf(overview: InvitationOverview | string): InvitationOverview {
  assert.notEqual(typeof overview, 'string', `the overview was refused: ${String(overview)}`);
  return overview as InvitationOverview;
}

describe('OrganizationAdministration invitation overview', () => {
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
