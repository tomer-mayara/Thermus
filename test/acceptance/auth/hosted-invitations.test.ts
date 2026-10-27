import { pendingInvitationsIn } from '../../support/drivers/browser/pending-invitations-page.ts';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { statusesOf } from '../../support/dsl/hosted-access.ts';
import { labelsOf, recordLines, rolesOf, serveAdministrationSite as serve, shownPage, submitOnPage } from '../../support/dsl/hosted-administration.ts';
import { formLabelled, formsIn } from '../../support/drivers/browser/hosted-browser.ts';
import { userOf } from '../../support/fixtures/hosted-members.ts';
import { adminGrant, userGrant } from '../../support/fixtures/hosted-roles.ts';

const membersPage = 'https://thermus.example/team/members';
const deniedChange = /Your account cannot make this change in the selected organization\./;
const removalLabels = ['sam', 'otto', 'cy', 'fay', 'eve', 'una'].map(name => `Remove ${name}@example.com`);



describe('Hosted invitations through the public routes, with session and directory doubles', () => {
  test('Given two Admins, when each sends a native invitation, then each can invite either role, unsupported roles are refused, and accepted Admin access includes product access', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);
    const eve = site.browserOf(userOf('user-eve', 'org-a'));
    const sam = site.browserOf(userOf('user-sam', 'org-a'));
    const evePage = await shownPage(eve, 'members');
    const samPage = await shownPage(sam, 'members');

    const userInvitation = await submitOnPage(eve, 'members', { label: 'Send invitation', filled: { email: 'new.user@example.com' } });
    const adminInvitation = await submitOnPage(sam, 'members', { label: 'Send invitation', filled: { email: 'new.admin@example.com', role: 'admin' } });
    const inviteUser = formLabelled(evePage.forms, 'Send invitation');
    const inviteAdmin = formLabelled(samPage.forms, 'Send invitation');
    const forged = [
      await eve.submit({ ...inviteUser, fields: { ...inviteUser.fields, email: 'forged@example.com', role: 'owner' } }),
      await eve.submit({ ...inviteUser, fields: { ...inviteUser.fields, email: 'forged@example.com', role: 'super-admin' } }),
      await sam.submit({ ...inviteAdmin, fields: { ...inviteAdmin.fields, email: 'forged@example.com', role: 'member' } }),
    ];
    site.directory.acceptInvitation(site.directory.invitationTo('new.admin@example.com')?.invitationId ?? '', 'user-nia');
    const nia = await statusesOf(site.browserOf(userOf('user-nia', 'org-a')), ['members', 'portal']);
    const shown = pendingInvitationsIn((await eve.open('members')).body);

    assert.deepEqual([labelsOf(evePage.forms), labelsOf(samPage.forms)], [['Send invitation', ...removalLabels], ['Send invitation', ...removalLabels]]);
    for (const page of [evePage, samPage]) assert.deepEqual(page.forms.filter(form => form.action === '/team/members/remove').map(form => form.label), removalLabels);
    assert.deepEqual([userInvitation.status, userInvitation.location?.href], [303, membersPage]);
    assert.deepEqual([adminInvitation.status, adminInvitation.location?.href], [303, membersPage]);
    for (const answer of forged) {
      assert.equal(answer.status, 403, answer.body);
      assert.match(answer.body, deniedChange);
    }
    assert.deepEqual(site.directory.invitationChanges, ['send org-a user new.user@example.com', 'send org-a admin new.admin@example.com']);
    assert.deepEqual(rolesOf(site, 'user-nia', 'org-a'), ['admin']);
    assert.deepEqual(nia, { members: 200, portal: 200 });
    assert.deepEqual(shown, [{ email: 'new.user@example.com', role: 'User' }]);
    assert.deepEqual(recordLines(site.records), [
      'user-eve in org-a: invite user for new.user@example.com: applied',
      'user-sam in org-a: invite admin for new.admin@example.com: applied',
      'user-eve in org-a: invite owner for forged@example.com: denied',
      'user-eve in org-a: invite super-admin for forged@example.com: denied',
      'user-sam in org-a: invite member for forged@example.com: denied',
    ]);
  });

  test('Given pending, accepted, revoked, and expired invitations, when an Admin resends and revokes them, then only pending invitations appear and only pending invitations of its organization change, and no invitation token reaches a page or a record', { timeout: 20_000 }, async (t) => {
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
    const page = await shownPage(eve, 'members');
    const resend = formLabelled(page.forms, 'Resend the invitation to pending.user@example.com');

    const resent = await eve.submit(resend);
    const revoked = await eve.submit(formLabelled(page.forms, 'Revoke the invitation to pending.user@example.com'));
    const resentAgain = await eve.submit(resend);
    const forged = [
      await eve.post('invitations/revoke', { ...resend.fields, invitation_id: 'invitation-5' }),
      await eve.post('invitations/revoke', { ...resend.fields, invitation_id: 'invitation-6' }),
      await eve.post('invitations/revoke', { ...resend.fields, invitation_id: 'invitation-2' }),
    ];
    const after = await eve.open('members');

    assert.deepEqual(pendingInvitationsIn(page.answer.body), [
      { email: 'pending.user@example.com', role: 'User' },
      { email: 'pending.admin@example.com', role: 'Admin' },
    ]);
    assert.deepEqual(labelsOf(page.forms), ['Send invitation', ...removalLabels, 'Resend the invitation to pending.user@example.com', 'Revoke the invitation to pending.user@example.com', 'Resend the invitation to pending.admin@example.com', 'Revoke the invitation to pending.admin@example.com']);
    assert.deepEqual(page.forms.filter(form => form.action === '/team/members/remove').map(form => form.label), removalLabels);
    assert.deepEqual([resent.status, revoked.status, resentAgain.status], [303, 303, 409]);
    assert.match(resentAgain.body, /The invitation is no longer pending/);
    assert.deepEqual(forged.map(({ status }) => status), [303, 403, 409]);
    assert.deepEqual(pendingInvitationsIn(after.body), []);
    assert.deepEqual(site.directory.invitationChanges, ['resend invitation-1', 'revoke invitation-1', 'revoke invitation-5']);
    assert.doesNotMatch(`${page.answer.body}${after.body}${JSON.stringify(site.records)}`, /secret-token/);
    assert.deepEqual(recordLines(site.records), [
      'user-eve in org-a: resend-invitation user for invitation-1: applied',
      'user-eve in org-a: revoke-invitation user for invitation-1: applied',
      'user-eve in org-a: resend-invitation user for invitation-1: not-pending',
      'user-eve in org-a: revoke-invitation admin for invitation-5: applied',
      'user-eve in org-a: revoke-invitation - for invitation-6: denied',
      'user-eve in org-a: revoke-invitation user for invitation-2: not-pending',
    ]);
  });

  test('Given a directory that enforces the invited address and then one that accepts by its own rules, when Members opens, then the page claims a strict address match only for the first', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);
    const eve = site.browserOf(userOf('user-eve', 'org-a'));

    const strict = (await eve.open('members')).body;
    site.directory.invitationIdentityPolicy = 'provider-rules';
    const providerRules = (await eve.open('members')).body;

    assert.match(strict, /Only a sign-in with the invited email address can accept the invitation\./);
    assert.match(providerRules, /The sign-in service decides who can accept the invitation\. It can accept a sign-in with another address, for example an address of the same domain\./);
    assert.doesNotMatch(providerRules, /Only a sign-in with the invited email address/);
  });

  test('Given an inactive membership with User and Admin and a pending membership with User, when an Admin invites the first address as User, another Admin invites the second as Admin, and each person accepts, then each membership becomes active with only the role of its invitation, so that no invitation restores a grant outside the authority of its sender', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);
    site.directory.addMembers({ subject: 'user-ida', organizationId: 'org-a', grants: [userGrant, adminGrant], status: 'inactive' });

    await submitOnPage(site.browserOf(userOf('user-eve', 'org-a')), 'members', { label: 'Send invitation', filled: { email: 'ida@example.com' } });
    await submitOnPage(site.browserOf(userOf('user-sam', 'org-a')), 'members', { label: 'Send invitation', filled: { email: 'pia@example.com', role: 'admin' } });
    for (const [email, subject] of [['ida@example.com', 'user-ida'], ['pia@example.com', 'user-pia']] as const) {
      site.directory.acceptInvitation(site.directory.invitationTo(email)?.invitationId ?? '', subject);
    }
    const ida = await statusesOf(site.browserOf(userOf('user-ida', 'org-a')), ['portal', 'members']);
    const pia = await statusesOf(site.browserOf(userOf('user-pia', 'org-a')), ['portal', 'members']);

    assert.deepEqual([rolesOf(site, 'user-ida', 'org-a'), rolesOf(site, 'user-pia', 'org-a')], [['user'], ['admin']]);
    assert.deepEqual([ida, pia], [{ portal: 200, members: 403 }, { portal: 200, members: 200 }]);
  });
  test('Given a pending User invitation, when an Admin sends the same address as User again, also in another letter case, then nothing is sent and the browser returns to Members; after another Admin revokes the invitation, a new send is a new invitation', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);
    const eve = site.browserOf(userOf('user-eve', 'org-a'));
    const send = (email: string) => submitOnPage(eve, 'members', { label: 'Send invitation', filled: { email } });

    const answers = [await send('new.user@example.com'), await send('New.User@Example.com')];
    await submitOnPage(site.browserOf(userOf('user-cy', 'org-a')), 'members', 'Revoke the invitation to new.user@example.com');
    answers.push(await send('new.user@example.com'));

    assert.deepEqual(answers.map(({ status, location }) => [status, location?.href]), answers.map(() => [303, membersPage]));
    assert.deepEqual(site.directory.invitationChanges, ['send org-a user new.user@example.com', 'revoke invitation-1', 'send org-a user new.user@example.com']);
    assert.deepEqual(recordLines(site.records).map((line) => line.replace(/^.* invite user for /, '')), [
      'new.user@example.com: applied',
      'New.User@Example.com: unchanged',
      'user-cy in org-a: revoke-invitation user for invitation-1: applied',
      'new.user@example.com: applied',
    ]);
  });
  test('Given an Admin without completed MFA, when it opens Members and sends either invitation role, then password access permits both and records each applied change', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);
    const sam = site.browserOf(userOf('user-sam', 'org-a'), { mfaCompleted: false });
    const token = formsIn((await sam.open('organizations')).body)[0]?.fields.csrf_token ?? '';
    assert.equal((await sam.open('members')).status, 200);
    for (const role of ['user', 'admin']) {
      const post = await sam.post('invitations/send', { csrf_token: token, organization_id: 'org-a', role, email: `new.${role}@example.com` });
      assert.equal(post.status, 303, post.body);
    }
    assert.deepEqual(site.directory.invitationChanges, ['send org-a user new.user@example.com', 'send org-a admin new.admin@example.com']);
    assert.deepEqual(recordLines(site.records), [
      'user-sam in org-a: invite user for new.user@example.com: applied',
      'user-sam in org-a: invite admin for new.admin@example.com: applied',
    ]);
  });
});
