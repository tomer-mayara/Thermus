import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { labelsOf, recordLines, rolesOf, serveAdministrationSite as serve, shownPage, submitOnPage } from '../../support/dsl/hosted-administration.ts';
import { formsIn } from '../../support/drivers/browser/hosted-browser.ts';
import { adminGrant, formFor, statusesOf, userGrant, userOf } from '../../support/in-process/hosted-organization-site.ts';

const invitationsPage = 'https://thermus.example/team/invitations';
const deniedChange = /Your account cannot make this change in the selected organization\./;

function invitationLines(body: string): readonly string[] {
  return [...body.matchAll(/<p>([^<]* invitation, (?:pending|accepted|revoked|expired)\.)<\/p>/g)].map(([, line = '']) => line);
}

describe('Hosted invitations through the public routes, with session and directory doubles', () => {
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
      'user-eve in org-a: revoke-invitation - for invitation-6: denied',
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

  test('Given an inactive membership with User and Admin and a pending membership with User, when an Admin invites the first address as User, a Super Admin invites the second as Admin, and each person accepts, then each membership becomes active with only the role of its invitation, so that no invitation restores a grant outside the authority of its sender', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);
    site.directory.addMembers({ subject: 'user-ida', organizationId: 'org-a', grants: [userGrant, adminGrant], status: 'inactive' });

    await submitOnPage(site.browserOf(userOf('user-eve', 'org-a')), 'invitations', { label: 'Invite as User', filled: { email: 'ida@example.com' } });
    await submitOnPage(site.browserOf(userOf('user-sam', 'org-a')), 'invitations', { label: 'Invite as Admin', filled: { email: 'pia@example.com' } });
    for (const [email, subject] of [['ida@example.com', 'user-ida'], ['pia@example.com', 'user-pia']] as const) {
      site.directory.acceptInvitation(site.directory.invitationTo(email)?.invitationId ?? '', subject);
    }
    const ida = await statusesOf(site.browserOf(userOf('user-ida', 'org-a')), ['portal', 'members']);
    const pia = await statusesOf(site.browserOf(userOf('user-pia', 'org-a')), ['portal', 'members']);

    assert.deepEqual([rolesOf(site, 'user-ida', 'org-a'), rolesOf(site, 'user-pia', 'org-a')], [['user'], ['admin']]);
    assert.deepEqual([ida, pia], [{ portal: 200, members: 403 }, { portal: 403, members: 200 }]);
  });
  test('Given a pending User invitation, when an Admin sends the same address as User again, also in another letter case, then nothing is sent and the browser returns to the invitations page; after another Admin revokes the invitation, a new send is a new invitation', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);
    const eve = site.browserOf(userOf('user-eve', 'org-a'));
    const send = (email: string) => submitOnPage(eve, 'invitations', { label: 'Invite as User', filled: { email } });

    const answers = [await send('new.user@example.com'), await send('New.User@Example.com')];
    await submitOnPage(site.browserOf(userOf('user-cy', 'org-a')), 'invitations', 'Revoke the invitation to new.user@example.com');
    answers.push(await send('new.user@example.com'));

    assert.deepEqual(answers.map(({ status, location }) => [status, location?.href]), answers.map(() => [303, invitationsPage]));
    assert.deepEqual(site.directory.invitationChanges, ['send org-a user new.user@example.com', 'revoke invitation-1', 'send org-a user new.user@example.com']);
    assert.deepEqual(recordLines(site.records).map((line) => line.replace(/^.* invite user for /, '')), [
      'new.user@example.com: applied',
      'New.User@Example.com: unchanged',
      'user-cy in org-a: revoke-invitation user for invitation-1: applied',
      'new.user@example.com: applied',
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
