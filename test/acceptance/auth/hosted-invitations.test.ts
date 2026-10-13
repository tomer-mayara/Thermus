import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import type { AccountFailureReport } from '../../../src/hosted-admin/account-routes.ts';
import { administrationMembers, labelsOf, recordLines, rolesOf, seatsIn, shownPage, submitOnPage } from '../../support/hosted-administration.ts';
import { formsIn } from '../../support/hosted-browser.ts';
import { formFor, serveOrganizationSite, statusesOf, userOf } from '../../support/hosted-organization-site.ts';

const invitationsPage = 'https://magumagu.example/team/invitations';
const deniedChange = /Your account cannot make this change in the selected organization\./;
const failurePage = /The request failed\. Try again later\./;

async function serve(t: TestContext) {
  const failures: AccountFailureReport[] = [];
  const site = await serveOrganizationSite(t, { reportFailure: (report) => failures.push(report), memberships: administrationMembers });
  return { ...site, failures };
}

function invitationLines(body: string): readonly string[] {
  return [...body.matchAll(/<p>([^<]* invitation, (?:pending|accepted|revoked|expired)\.)<\/p>/g)].map(([, line = '']) => line);
}

describe('Hosted invitations and the User seat summary through the public routes, with session and directory doubles', () => {
  test('Given an Admin and a Super Admin, when each sends an invitation from the invitations page, then the Admin can invite only User and the Super Admin only Admin, a forged role is refused, and an accepted Admin invitation gives Admin without User', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);
    const eve = site.browserOf(userOf('user-eve', 'org-a'));
    const sam = site.browserOf(userOf('user-sam', 'org-a'));
    const evePage = await shownPage(eve, 'invitations');
    const samPage = await shownPage(sam, 'invitations');

    const userInvitation = await submitOnPage(eve, 'invitations', { label: 'Invite as User', filled: { email: 'new.user@example.com' } });
    const adminInvitation = await submitOnPage(sam, 'invitations', { label: 'Invite as Admin', filled: { email: 'new.admin@example.com' } });
    const inviteUser = formFor(evePage.forms, 'Invite as User');
    const inviteAdmin = formFor(samPage.forms, 'Invite as Admin');
    const forged = [
      await eve.submit({ ...inviteUser, fields: { ...inviteUser.fields, email: 'forged@example.com', role: 'admin' } }),
      await eve.submit({ ...inviteUser, fields: { ...inviteUser.fields, email: 'forged@example.com', role: 'super-admin' } }),
      await sam.submit({ ...inviteAdmin, fields: { ...inviteAdmin.fields, email: 'forged@example.com', role: 'user' } }),
    ];
    site.directory.acceptInvitation(site.directory.invitationTo('new.admin@example.com')?.invitationId ?? '', 'user-nia');
    const nia = await statusesOf(site.browserOf(userOf('user-nia', 'org-a')), ['members', 'portal']);
    const shown = invitationLines((await eve.open('invitations')).body);

    assert.deepEqual([labelsOf(evePage.forms), labelsOf(samPage.forms)], [['Invite as User'], ['Invite as Admin']]);
    assert.deepEqual([userInvitation.status, userInvitation.location?.href], [303, invitationsPage]);
    assert.deepEqual([adminInvitation.status, adminInvitation.location?.href], [303, invitationsPage]);
    for (const answer of forged) {
      assert.equal(answer.status, 403, answer.body);
      assert.match(answer.body, deniedChange);
    }
    assert.deepEqual(site.directory.invitationChanges, ['send org-a user new.user@example.com', 'send org-a admin new.admin@example.com']);
    assert.deepEqual(rolesOf(site, 'user-nia', 'org-a'), ['admin']);
    assert.deepEqual(nia, { members: 200, portal: 403 });
    assert.deepEqual(shown, ['new.user@example.com: User invitation, pending.', 'new.admin@example.com: Admin invitation, accepted.']);
    assert.deepEqual(recordLines(site.records), [
      'user-eve in org-a: invite user for new.user@example.com: applied',
      'user-sam in org-a: invite admin for new.admin@example.com: applied',
      'user-eve in org-a: invite admin for forged@example.com: denied',
      'user-eve in org-a: invite super-admin for forged@example.com: denied',
      'user-sam in org-a: invite user for forged@example.com: denied',
    ]);
  });

  test('Given pending, accepted, revoked, and expired invitations, when an Admin resends and revokes them, then each state shows as the directory gives it, only a pending User invitation of its organization changes, and no invitation token reaches a page or a record', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);
    site.directory.addInvitations(
      { organizationId: 'org-a', email: 'pending.user@example.com', role: 'user' },
      { organizationId: 'org-a', email: 'accepted.user@example.com', role: 'user', state: 'accepted' },
      { organizationId: 'org-a', email: 'revoked.user@example.com', role: 'user', state: 'revoked' },
      { organizationId: 'org-a', email: 'expired.user@example.com', role: 'user', state: 'expired' },
      { organizationId: 'org-a', email: 'pending.admin@example.com', role: 'admin' },
      { organizationId: 'org-b', email: 'globex.user@example.com', role: 'user' },
    );
    const eve = site.browserOf(userOf('user-eve', 'org-a'));
    const page = await shownPage(eve, 'invitations');
    const resend = formFor(page.forms, 'Resend the invitation to pending.user@example.com');

    const resent = await eve.submit(resend);
    const revoked = await eve.submit(formFor(page.forms, 'Revoke the invitation to pending.user@example.com'));
    const resentAgain = await eve.submit(resend);
    const forged = [
      await eve.post('invitations/revoke', { ...resend.fields, invitation_id: 'invitation-5' }),
      await eve.post('invitations/revoke', { ...resend.fields, invitation_id: 'invitation-6' }),
      await eve.post('invitations/revoke', { ...resend.fields, invitation_id: 'invitation-2' }),
    ];
    const after = await eve.open('invitations');

    assert.deepEqual(invitationLines(page.answer.body), [
      'pending.user@example.com: User invitation, pending.',
      'accepted.user@example.com: User invitation, accepted.',
      'revoked.user@example.com: User invitation, revoked.',
      'expired.user@example.com: User invitation, expired.',
      'pending.admin@example.com: Admin invitation, pending.',
    ]);
    assert.deepEqual(labelsOf(page.forms), ['Invite as User', 'Resend the invitation to pending.user@example.com', 'Revoke the invitation to pending.user@example.com']);
    assert.deepEqual([resent.status, revoked.status, resentAgain.status], [303, 303, 409]);
    assert.match(resentAgain.body, /The invitation is no longer pending/);
    assert.deepEqual(forged.map(({ status }) => status), [403, 403, 409]);
    assert.equal(invitationLines(after.body)[0], 'pending.user@example.com: User invitation, revoked.');
    assert.deepEqual(site.directory.invitationChanges, ['resend invitation-1', 'revoke invitation-1']);
    assert.doesNotMatch(`${page.answer.body}${after.body}${JSON.stringify(site.records)}`, /secret-token/);
    assert.deepEqual(recordLines(site.records), [
      'user-eve in org-a: resend-invitation user for invitation-1: applied',
      'user-eve in org-a: revoke-invitation user for invitation-1: applied',
      'user-eve in org-a: resend-invitation user for invitation-1: not-pending',
      'user-eve in org-a: revoke-invitation admin for invitation-5: denied',
      'user-eve in org-a: revoke-invitation user for invitation-6: denied',
      'user-eve in org-a: revoke-invitation user for invitation-2: not-pending',
    ]);
  });

  test('Given a directory that enforces the invited address and then one that accepts by its own rules, when the invitations page opens, then the page claims a strict address match only for the first', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);
    const eve = site.browserOf(userOf('user-eve', 'org-a'));

    const strict = (await eve.open('invitations')).body;
    site.directory.invitationIdentityPolicy = 'provider-rules';
    const providerRules = (await eve.open('invitations')).body;

    assert.match(strict, /Only a sign-in with the invited email address can accept the invitation\./);
    assert.match(providerRules, /The sign-in service decides who can accept the invitation\. It can accept a sign-in with another address, for example an address of the same domain\./);
    assert.doesNotMatch(providerRules, /Only a sign-in with the invited email address/);
  });

  test('Given members on several pages, with members repeated at the page boundaries, when an Admin and a Super Admin open the members page, then the seat summary counts each active membership with User once, and Admin-only, Super-Admin-only, default-role, pending, and inactive memberships and pending invitations do not count', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);
    site.directory.addInvitations({ organizationId: 'org-a', email: 'pending.user@example.com', role: 'user' });
    site.directory.memberPageLayout = (members) => [members.slice(0, 3), members.slice(2, 6), members.slice(5)];

    const acme = { admin: (await site.browserOf(userOf('user-eve', 'org-a')).open('members')).body, superAdmin: (await site.browserOf(userOf('user-sam', 'org-a')).open('members')).body };
    const globex = (await site.browserOf(userOf('user-ben', 'org-b')).open('members')).body;
    const userOnly = await site.browserOf(userOf('user-una', 'org-a')).open('members');

    assert.deepEqual([seatsIn(acme.admin), seatsIn(acme.superAdmin), seatsIn(globex)], [4, 4, 3]);
    assert.equal(userOnly.status, 403);
    assert.equal(seatsIn(userOnly.body), undefined);
    assert.deepEqual([...new Set(site.directory.memberPageReads.map(({ statuses }) => statuses.join()))], ['active,inactive,pending']);
    assert.ok(site.directory.memberPageReads.some(({ cursor }) => cursor !== undefined), 'the page reads followed the cursors');
    assert.deepEqual(site.failures, []);
  });

  test('Given a member page or an invitation page that fails to load, when the members page or the invitations page opens, then each gives the failure page without a partial number or list, and the operator gets the path and the cause', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);
    site.directory.memberPageLayout = (members) => [members.slice(0, 2), new Error('member page 2 timed out'), members.slice(4)];
    site.directory.invitationPageLayout = () => [new Error('invitation page 1 timed out')];
    const otto = site.browserOf(userOf('user-otto', 'org-a'));

    const members = await otto.open('members');
    const invitations = await otto.open('invitations');

    for (const answer of [members, invitations]) {
      assert.equal(answer.status, 500);
      assert.match(answer.body, failurePage);
      assert.deepEqual(formsIn(answer.body), []);
    }
    assert.equal(seatsIn(members.body), undefined);
    assert.deepEqual(site.failures.map(({ path, cause }) => `${path}: ${String(cause)}`), [
      '/team/members: Error: member page 2 timed out',
      '/team/invitations: Error: invitation page 1 timed out',
    ]);
  });

  test('Given a Super Admin whose sign-in did not complete MFA, when it opens the invitations page or sends an invitation with the form token of its session, then each is refused with the MFA notice, nothing is sent, and the refused change is recorded', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);
    const sam = site.browserOf(userOf('user-sam', 'org-a'), { mfaCompleted: false });
    const token = formsIn((await sam.open('organizations')).body)[0]?.fields.csrf_token ?? '';

    const page = await sam.open('invitations');
    const post = await sam.post('invitations/send', { csrf_token: token, organization_id: 'org-a', role: 'admin', email: 'new.admin@example.com' });

    for (const answer of [page, post]) {
      assert.equal(answer.status, 403);
      assert.match(answer.body, /Administration needs a sign-in that completed multi-factor authentication\./);
    }
    assert.deepEqual(site.directory.invitationChanges, []);
    assert.deepEqual(recordLines(site.records), ['user-sam in org-a: invite admin for new.admin@example.com: mfa-required']);
  });
});
