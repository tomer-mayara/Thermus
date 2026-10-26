import assert from 'node:assert/strict';
import { test } from 'node:test';
import { serveAdministrationSite, shownPage, toolOutcome } from '../../support/dsl/hosted-administration.ts';
import { formLabelled } from '../../support/drivers/browser/hosted-browser.ts';
import { administrationMembers, userOf } from '../../support/fixtures/hosted-members.ts';
import { memberRole, userGrant } from '../../support/fixtures/hosted-roles.ts';

test('Given a User and Admin with existing browser and MCP sessions in two organizations, when the provider removes Admin in one, then old invitation forms and Members are denied there while product and other organization access remain', async (t) => {
  const site = await serveAdministrationSite(t);
  const browser = site.browserOf(userOf('user-cy', 'org-a'));
  const invite = formLabelled((await shownPage(browser, 'members')).forms, 'Send invitation');
  assert.equal((await browser.open('members')).status, 200);
  assert.equal(await toolOutcome(site, 'user-cy-token'), 'done');

  site.directory.replaceMemberships(administrationMembers.map((member) => member.subject === 'user-cy' && member.organizationId === 'org-a' ? { ...member, grants: [userGrant] } : member));
  const staleInvite = await browser.submit({ ...invite, fields: { ...invite.fields, email: 'new@example.com' } });

  assert.equal(staleInvite.status, 403);
  assert.equal((await browser.open('members')).status, 403);
  assert.equal((await browser.open('portal')).status, 200);
  assert.equal(await toolOutcome(site, 'user-cy-token'), 'done');
  assert.equal(await toolOutcome(site, 'user-cy-globex-token'), 'done');
  assert.equal(site.directory.invitationTo('new@example.com'), undefined);
  assert.deepEqual(site.directory.invitationChanges, []);
});

test('Given a User with browser and MCP sessions in two organizations, when the provider removes its last application grant in one, then access stops there without ending identity or access in the other organization', async (t) => {
  const site = await serveAdministrationSite(t);
  const browser = site.browserOf(userOf('user-una', 'org-a'));
  const before = site.directory.membershipIn('user-una', 'org-a');
  assert.equal((await browser.open('portal')).status, 200);
  assert.equal(await toolOutcome(site, 'user-una-token'), 'done');

  site.directory.replaceMemberships(administrationMembers.map((member) => member.subject === 'user-una' && member.organizationId === 'org-a' ? { ...member, grants: [memberRole] } : member));

  assert.equal((await browser.open('portal')).status, 403);
  assert.equal(await toolOutcome(site, 'user-una-token'), 'refused');
  assert.equal(await toolOutcome(site, 'user-una-globex-token'), 'done');
  const organizations = await browser.open('organizations');
  assert.equal(organizations.status, 200);
  assert.match(organizations.body, /Globex/);
  assert.deepEqual([site.directory.membershipIn('user-una', 'org-a')?.membershipId, site.directory.membershipIn('user-una', 'org-a')?.status], [before?.membershipId, 'active']);
});
