import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { serveAdministrationSite, shownPage, submitOnPage } from '../../support/dsl/hosted-administration.ts';
import { formsIn } from '../../support/drivers/browser/hosted-browser.ts';
import { userOf } from '../../support/fixtures/hosted-members.ts';

describe('Members through the hosted HTTP server', () => {
  test('Given an Admin and invitations in several states, when Members opens, then one page shows current members, You, pending expiry, navigation, and one invitation form', async (t) => {
    const site = await serveAdministrationSite(t);
    site.directory.addInvitations(
      { organizationId: 'org-a', email: 'new@example.com', role: 'user' },
      { organizationId: 'org-a', email: 'old@example.com', role: 'admin', state: 'expired' },
      { organizationId: 'org-b', email: 'other@example.com', role: 'user' },
    );
    const admin = site.browserOf(userOf('user-eve', 'org-a'), { mfaCompleted: false });

    const { answer, forms } = await shownPage(admin, 'members');

    assert.equal(answer.status, 200, answer.body);
    assert.match(answer.body, /Invite to Acme<\/h2>/);
    assert.equal(forms[0]?.fields.organization_id, 'org-a');
    assert.match(answer.body, /href="\/team\/">Product \/ Connect<\/a>/);
    assert.match(answer.body, /href="\/team\/members" aria-current="page">Members<\/a>/);
    assert.match(answer.body, /href="\/team\/logging"[^>]*>Logging<\/a>/);
    assert.match(answer.body, /href="\/team\/organizations">Switch workspace<\/a>/);
    assert.match(answer.body, /eve@example\.com[\s\S]*?You/);
    assert.match(answer.body, /new@example\.com: User invitation, pending\./);
    assert.match(answer.body, /Expires <time datetime="[^"]+">/);
    assert.doesNotMatch(answer.body, /old@example\.com|other@example\.com|ivy@example\.com|pia@example\.com/);
    assert.deepEqual(forms.map(({ label }) => label), ['Invite', 'Resend the invitation to new@example.com', 'Revoke the invitation to new@example.com']);
    assert.equal(forms[0]?.fields.role, 'user');
    assert.doesNotMatch(answer.body, /Change role|Remove member|Security|MFA|<script/);
    assert.equal((await site.browserOf(userOf('user-una', 'org-a')).open('members')).status, 403);
  });

  test('Given a Members page, when an Admin invites a User and an Admin and then resends and revokes, then each confirmed change returns to Members without changing active memberships', async (t) => {
    const site = await serveAdministrationSite(t);
    const admin = site.browserOf(userOf('user-eve', 'org-a'));
    const before = site.directory.membershipIn('user-eve', 'org-a');

    const sentUser = await submitOnPage(admin, 'members', { label: 'Invite', filled: { email: 'new.user@example.com' } });
    const sentAdmin = await submitOnPage(admin, 'members', { label: 'Invite', filled: { email: 'new.admin@example.com', role: 'admin' } });
    const resent = await submitOnPage(admin, 'members', 'Resend the invitation to new.user@example.com');
    const revoked = await submitOnPage(admin, 'members', 'Revoke the invitation to new.user@example.com');
    const after = await admin.open('members');

    for (const answer of [sentUser, sentAdmin, resent, revoked]) assert.deepEqual([answer.status, answer.location?.pathname], [303, '/team/members']);
    assert.deepEqual(site.directory.invitationChanges, ['send org-a user new.user@example.com', 'send org-a admin new.admin@example.com', 'resend invitation-1', 'revoke invitation-1']);
    assert.deepEqual(site.directory.membershipIn('user-eve', 'org-a'), before);
    assert.doesNotMatch(after.body, /new\.user@example\.com/);
    assert.match(after.body, /new\.admin@example\.com: Admin invitation, pending\./);
  });

  for (const [operation, path] of [['sendInvitation', 'invitations/send'], ['resendInvitation', 'invitations/resend'], ['revokeInvitation', 'invitations/revoke']] as const) {
    test(`Given an unconfirmed ${operation} response, when the Admin submits and checks status, then the page gives no retry form and the status read sends no second write`, async (t) => {
      const site = await serveAdministrationSite(t);
      site.directory.addInvitations({ organizationId: 'org-a', email: 'pending@example.com', role: 'user' });
      site.directory.queue(operation, { error: new Error('secret-token provider detail'), afterChange: true });
      const admin = site.browserOf(userOf('user-eve', 'org-a'));
      const page = await shownPage(admin, 'organizations');
      const token = page.forms[0]?.fields.csrf_token ?? '';

      const target: Record<string, string> = operation === 'sendInvitation' ? { email: 'new@example.com', role: 'user' } : { invitation_id: 'invitation-1' };
      const answer = await admin.post(path, { csrf_token: token, organization_id: 'org-a', ...target });

      assert.equal(answer.status, 503, answer.body);
      assert.match(answer.body, /The invitation change is not confirmed/);
      assert.match(answer.body, /href="\/team\/members">Check status<\/a>/);
      assert.match(answer.body, /A pending invitation does not confirm email delivery/);
      assert.deepEqual(formsIn(answer.body), []);
      assert.doesNotMatch(answer.body, /secret-token|Nothing changed|Try again|Retry/);
      assert.equal((await admin.open('members')).status, 200);
      assert.equal(site.directory.invitationChanges.length, 1);
    });
  }
});
