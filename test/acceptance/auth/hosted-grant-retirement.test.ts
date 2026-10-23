import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rolesOf, serveAdministrationSite, shownPage } from '../../support/dsl/hosted-administration.ts';
import { formsIn } from '../../support/drivers/browser/hosted-browser.ts';
import { userOf } from '../../support/fixtures/hosted-members.ts';

test('Given an Admin after password sign-in and a valid current User-grant form, when it posts to the retired grant path, then that path is unavailable, no role changes, and native invitations remain available', { timeout: 20_000 }, async (t) => {
  const site = await serveAdministrationSite(t);
  const admin = site.browserOf(userOf('user-eve', 'org-a'), { mfaCompleted: false });
  const organizations = await admin.open('organizations');
  assert.equal(organizations.status, 200, organizations.body);
  const csrfToken = formsIn(organizations.body).find(({ fields }) => fields.organization_id === 'org-a')?.fields.csrf_token;
  assert.ok(csrfToken, 'The current organization form supplies the session CSRF token.');
  const target = site.directory.membershipIn('user-dora', 'org-a');
  assert.ok(target, 'The target has a current membership in the Admin organization.');
  const before = rolesOf(site, 'user-dora', 'org-a');

  const submission = await admin.post('members/grants', {
    csrf_token: csrfToken,
    organization_id: 'org-a',
    membership_id: target.membershipId,
    revision: target.revision,
    role: 'user',
    action: 'grant',
  });
  const members = await shownPage(admin, 'members');
  const invitations = await admin.open('invitations');

  assert.deepEqual({
    status: submission.status,
    roles: rolesOf(site, 'user-dora', 'org-a'),
    membersStatus: members.answer.status,
    grantForms: members.forms.filter(({ action }) => action.endsWith('/members/grants')).length,
    invitationsStatus: invitations.status,
  }, {
    status: 404,
    roles: before,
    membersStatus: 200,
    grantForms: 0,
    invitationsStatus: 200,
  });
});
