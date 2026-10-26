import assert from 'node:assert/strict';
import { test } from 'node:test';
import { serveAdministrationSite, shownPage } from '../../support/dsl/hosted-administration.ts';
import { formLabelled } from '../../support/drivers/browser/hosted-browser.ts';
import { userOf } from '../../support/fixtures/hosted-members.ts';

test('Given an Admin and a current invitation form, when role, origin, CSRF, or selected organization is forged, then native invitation writes are refused and refreshed session cookies remain usable', async (t) => {
  const site = await serveAdministrationSite(t);
  const browser = site.browserOf(userOf('user-eve', 'org-a'));
  const form = formLabelled((await shownPage(browser, 'members')).forms, 'Send invitation');
  const fields = { ...form.fields, email: 'new@example.com' };
  const attempts = [
    { fields: { ...fields, role: 'super-admin' }, status: 403 },
    { fields: { ...fields, organization_id: 'org-b' }, status: 409 },
    { fields: { ...fields, csrf_token: 'forged' }, status: 403 },
    { fields, origin: 'https://evil.example', status: 403 },
  ];

  for (const attempt of attempts) {
    site.sessions.expireAccessToken(browser.cookieHeader);
    const answer = await browser.post('invitations/send', attempt.fields, { origin: attempt.origin });
    assert.equal(answer.status, attempt.status, answer.body);
    assert.equal(answer.cookies.length, 1);
  }

  assert.equal((await browser.open('members')).status, 200);
  assert.deepEqual(site.directory.invitationChanges, []);
});

test('Given a User without administration authority, when it opens Members or sends a native invitation, then current authority refuses both without changing provider state', async (t) => {
  const site = await serveAdministrationSite(t);
  const browser = site.browserOf(userOf('user-una', 'org-a'), { mfaCompleted: false });
  const organization = formLabelled((await shownPage(browser, 'organizations')).forms, 'Acme (selected)');

  const page = await browser.open('members');
  const invitation = await browser.post('invitations/send', { csrf_token: organization.fields.csrf_token ?? '', organization_id: 'org-a', email: 'new@example.com', role: 'user' });

  for (const answer of [page, invitation]) assert.equal(answer.status, 403);
  assert.deepEqual(site.directory.invitationChanges, []);
});
