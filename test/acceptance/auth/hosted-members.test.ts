import { pendingInvitationsIn } from '../../support/drivers/browser/pending-invitations-page.ts';
import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';
import { micromark } from 'micromark';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { serveAdministrationSite, shownPage, submitOnPage } from '../../support/dsl/hosted-administration.ts';
import { formsIn } from '../../support/drivers/browser/hosted-browser.ts';
import { administrationMembers, userOf } from '../../support/fixtures/hosted-members.ts';

describe('Members through the hosted HTTP server', () => {
  test('Given seven active members and six product members, when the Admin opens Members, then labelled read-only facts keep both counts and trusted self actions distinct', async (t) => {
    const site = await serveAdministrationSite(t);
    const admin = site.browserOf(userOf('user-eve', 'org-a'));
    const answer = await admin.open('members');
    assert.equal(answer.status, 200, answer.body);
    const document = parseHTML(answer.body).document;
    assert.equal(document.querySelector('h1')?.textContent, 'Members · 7');
    assert.match(answer.body, /Active product members: 6/);
    const rows = [...document.querySelectorAll('.member-list > li')];
    assert.equal(rows.length, 7);
    for (const row of rows) assert.deepEqual([...row.querySelectorAll('dt')].map(label => label.textContent), ['Member', 'Role', 'Action']);
    const self = rows.find(row => row.querySelector('.member-email')?.textContent === 'eve@example.com');
    assert.ok(self);
    assert.equal(self.querySelector('.you-label')?.textContent, 'You');
    assert.equal(document.querySelectorAll('.you-label').length, 1);
    assert.deepEqual([...self.querySelectorAll('summary')].map(summary => [summary.textContent, summary.getAttribute('aria-label')]), [['Leave…', 'Leave Acme as eve@example.com']]);
    assert.deepEqual([...self.querySelectorAll('button')].map(button => button.textContent), ['Leave Acme']);
    const other = rows.find(row => row.querySelector('.member-email')?.textContent === 'una@example.com');
    assert.ok(other);
    assert.deepEqual([...other.querySelectorAll('summary')].map(summary => [summary.textContent, summary.getAttribute('aria-label')]), [['Remove…', 'Remove una@example.com from Acme']]);
    const unsupported = rows.find(row => row.querySelector('.member-email')?.textContent === 'dora@example.com');
    assert.ok(unsupported);
    assert.deepEqual([...unsupported.querySelectorAll('.member-role dd')].map(role => role.textContent), ['none']);
    assert.equal(unsupported.querySelector('details, form, select'), null);
    assert.equal(document.querySelectorAll('.member-list select, .member-list input:not([type="hidden"])').length, 0);
  });

  test('Given an invitation read whose later page fails after a pending entry, when Members opens through the public route, then the existing failure has no partial list or count', async (t) => {
    const site = await serveAdministrationSite(t);
    site.directory.addInvitations({ organizationId: 'org-a', email: 'partial@example.com', role: 'user' });
    site.directory.invitationPageLayout = entries => [entries, new Error('later invitation page failed')];
    const answer = await site.browserOf(userOf('user-eve', 'org-a')).open('members');
    assert.equal(answer.status, 500);
    assert.doesNotMatch(answer.body, /partial@example.com|Pending invitations|No pending invitations|Active product members|<form|later invitation page failed/);
    assert.equal(site.directory.invitationPageReads.length, 2);
    assert.equal(site.failures.length, 1);
    assert.deepEqual(site.directory.invitationChanges, []);
  });

  test('Given an Admin in Acme Labs and unavailable Audit storage, when Members and Audit open through their page links, then one ordered header menu retains workspace context and marks only the current page', async (t) => {
    const site = await serveAdministrationSite(t);
    site.directory.replaceMemberships(administrationMembers.map(member => ({ ...member, organizationName: member.organizationId === 'org-a' ? 'Acme Labs' : member.organizationName })));
    const admin = site.browserOf(userOf('user-eve', 'org-a'));
    let answer = await admin.open('members');
    let document = parseHTML(answer.body).document;
    assert.equal(document.querySelector('header .workspace-name')?.textContent, 'Acme Labs');
    assert.equal(document.querySelector('.workspace-context a'), null, 'Workspace context must not create a second menu');
    for (const [current, destination] of [['Members', 'Audit Log'], ['Audit Log', 'Members']] as const) {
      assert.equal(answer.status, current === 'Members' ? 200 : 503);
      const links = [...document.querySelectorAll('header nav[aria-label="Workspace"] a')];
      assert.deepEqual(links.map(link => [link.textContent, link.getAttribute('href')]), [
        ['Connect', '/team/'], ['Switch Workspace', '/team/organizations'], ['Members', '/team/members'], ['Audit Log', '/team/logging'],
      ]);
      assert.deepEqual(links.filter(link => link.hasAttribute('aria-current')).map(link => [link.textContent, link.getAttribute('aria-current')]), [[current, 'page']]);
      const next = links.find(link => link.textContent === destination)?.getAttribute('href');
      assert.ok(next);
      answer = await admin.open(next);
      document = parseHTML(answer.body).document;
    }
    assert.equal(document.querySelector('header [aria-current="page"]')?.textContent, 'Members');
  });

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
    const document = parseHTML(answer.body).document;
    const help = document.querySelector('details[data-help="members"]');
    assert.ok(help, 'Complete removal help must be available without scripts');
    assert.equal(help.hasAttribute('open'), false);
    assert.equal(help.querySelector('summary')?.textContent, 'Member removal help');
    assert.equal(help.getAttribute('data-document-version'), 'hosted-members-help-organization-removal-proposal-2026-10-26-v1');
    assert.equal(help.getAttribute('data-document-sha256'), '853d344d0f861fd3a53ed05b846909108d56d39d6105a7fa4fcc626e0d1aa9ca');
    const canonical = await readFile('docs/legal/organization-removal-2026-10-26-proposal-v1/members-help.md', 'utf8');
    const expected = parseHTML(`<div>${micromark(canonical)}</div>`).document.querySelector('div')?.textContent;
    assert.equal(help.querySelector('.administration-help-content')?.textContent, expected);
    assert.equal(help.querySelector('a')?.getAttribute('href'), 'https://thermus.ai/privacy/');
    assert.equal(help.querySelectorAll('form, input, script').length, 0);
    assert.equal(help.closest('form'), null);
    assert.deepEqual(site.directory.invitationChanges, []);
    assert.match(answer.body, /Invite to Acme<\/h2>/);
    assert.equal(forms[0]?.fields.organization_id, 'org-a');
    assert.match(answer.body, /href="\/team\/">Connect<\/a>/);
    assert.match(answer.body, /href="\/team\/members" aria-current="page">Members<\/a>/);
    assert.match(answer.body, /href="\/team\/logging"[^>]*>Audit Log<\/a>/);
    assert.match(answer.body, /href="\/team\/organizations">Switch Workspace<\/a>/);
    assert.match(answer.body, /eve@example\.com[\s\S]*?You/);
    assert.ok(pendingInvitationsIn(answer.body).some(entry => entry.email === 'new@example.com' && entry.role === 'User'));
    assert.match(answer.body, /Expires <time datetime="[^"]+">/);
    assert.doesNotMatch(answer.body, /old@example\.com|other@example\.com|ivy@example\.com|pia@example\.com/);
    assert.deepEqual(forms.filter(({ fields }) => fields.membership_id === undefined).map(({ label }) => label), ['Send invitation', 'Resend the invitation to new@example.com', 'Revoke the invitation to new@example.com']);
    assert.equal(forms.filter(({ fields }) => fields.membership_id !== undefined).length, 6);
    assert.equal(forms[0]?.fields.role, 'user');
    assert.doesNotMatch(answer.body, /Change role|Security|MFA|<script/);
    assert.equal((await site.browserOf(userOf('user-una', 'org-a')).open('members')).status, 403);
  });

  test('Given a Members page, when an Admin invites a User and an Admin and then resends and revokes, then each confirmed change returns to Members without changing active memberships', async (t) => {
    const site = await serveAdministrationSite(t);
    const admin = site.browserOf(userOf('user-eve', 'org-a'));
    const before = site.directory.membershipIn('user-eve', 'org-a');

    const sentUser = await submitOnPage(admin, 'members', { label: 'Send invitation', filled: { email: 'new.user@example.com' } });
    const sentAdmin = await submitOnPage(admin, 'members', { label: 'Send invitation', filled: { email: 'new.admin@example.com', role: 'admin' } });
    const resent = await submitOnPage(admin, 'members', 'Resend the invitation to new.user@example.com');
    const revoked = await submitOnPage(admin, 'members', 'Revoke the invitation to new.user@example.com');
    const after = await admin.open('members');

    for (const answer of [sentUser, sentAdmin, resent, revoked]) assert.deepEqual([answer.status, answer.location?.pathname], [303, '/team/members']);
    assert.deepEqual(site.directory.invitationChanges, ['send org-a user new.user@example.com', 'send org-a admin new.admin@example.com', 'resend invitation-1', 'revoke invitation-1']);
    assert.deepEqual(site.directory.membershipIn('user-eve', 'org-a'), before);
    assert.doesNotMatch(after.body, /new\.user@example\.com/);
    assert.ok(pendingInvitationsIn(after.body).some(entry => entry.email === 'new.admin@example.com' && entry.role === 'Admin'));
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
