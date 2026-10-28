import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { serveAdministrationSite, submitOnPage } from '../../support/dsl/hosted-administration.ts';
import { userOf } from '../../support/fixtures/hosted-members.ts';
import { hostedConfig } from '../../support/fixtures/hosted-config.ts';

test('Given a current Admin, when Quick start opens with another organization in its query, then the selected organization owns the guide and configured MCP URL', async (t) => {
  const site = await serveAdministrationSite(t);
  const browser = site.browserOf(userOf('user-sam', 'org-a'));
  const page = await browser.open('quick-start?organization_id=org-b&organization_name=Injected');
  assert.equal(page.status, 200, page.body);
  const document = parseHTML(page.body).document;
  assert.equal(document.querySelector('h1')?.textContent, 'Quick start');
  assert.equal(document.querySelector('.workspace-name')?.textContent, 'Acme');
  assert.deepEqual([...document.querySelectorAll('nav[aria-label="Workspace"] a')].map(link => link.textContent),
    ['Quick start', 'Connect', 'Switch Workspace', 'Members', 'Audit Log']);
  assert.equal(document.querySelector('nav [aria-current="page"]')?.textContent, 'Quick start');
  assert.ok(page.body.includes(hostedConfig.mcpResourceUrl));
  assert.doesNotMatch(page.body, /Injected|Globex/);
});

test('Given memberships in two workspaces, when the Admin switches to a User workspace and back, then Quick start follows current authority', async (t) => {
  const site = await serveAdministrationSite(t);
  const browser = site.browserOf(userOf('user-cy', 'org-a'));
  assert.equal((await browser.open('quick-start')).status, 200);
  assert.equal((await submitOnPage(browser, 'organizations', 'Globex')).status, 303);
  assert.equal((await browser.open('quick-start')).status, 403);
  assert.equal((await submitOnPage(browser, 'organizations', 'Acme')).status, 303);
  assert.equal((await browser.open('quick-start')).status, 200);
  site.directory.replaceMemberships([]);
  assert.equal((await browser.open('quick-start')).status, 403);
});

for (const user of [userOf('user-una', 'org-a'), userOf('user-sam')]) {
  test(`Given ${user.selectedOrganizationId ? 'a User' : 'no selected workspace'}, when Quick start is requested, then access is denied`, async (t) => {
    const site = await serveAdministrationSite(t);
    assert.equal((await site.browserOf(user).open('quick-start')).status, 403);
  });
}
