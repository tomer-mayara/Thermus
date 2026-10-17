import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import { formLabelled, formsIn, type BrowserAnswer } from '../../support/drivers/browser/hosted-browser.ts';
import { statusesOf } from '../../support/dsl/hosted-access.ts';
import { userOf } from '../../support/fixtures/hosted-members.ts';
import { superAdminGrant } from '../../support/fixtures/hosted-roles.ts';
import { serveOrganizationSite } from '../../support/in-process/hosted-organization-site.ts';

const nora = userOf('user-nora');
const ivy = userOf('user-ivy', 'org-a');
const dora = userOf('user-dora', 'org-a');
const mia = userOf('user-mia', 'org-a');
const sam = userOf('user-sam');

function serve(t: TestContext) {
  return serveOrganizationSite(t, { reportFailure: () => assert.fail('no account request may fail'), mcpUsers: [userOf('user-sam', 'org-a')] });
}

function assertHtmlPage(answer: BrowserAnswer): void {
  assert.equal(answer.status, 200, answer.body);
  assert.match(answer.headers.get('Content-Type') ?? '', /^text\/html/);
  assert.equal(answer.headers.get('Cache-Control'), 'no-store');
}

describe('Hosted organization onboarding and selection through the public routes, with session and directory doubles', () => {
  test('Given signed-in users without an authorized active organization — no membership, an inactive membership, or a membership whose role grants no application permission —, when each opens the organization page, then it tells them to accept an invitation or to contact the operator, offers no organization, and every tenant page stays refused without a default tenant or role, with a link to the organization page', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);

    for (const user of [nora, ivy, dora]) {
      const browser = site.browserOf(user);
      const onboarding = await browser.open('organizations');

      assertHtmlPage(onboarding);
      assert.match(onboarding.body, /accept the invitation/, user.subject);
      assert.match(onboarding.body, /contact the operator/, user.subject);
      assert.deepEqual(formsIn(onboarding.body), [], user.subject);
      assert.deepEqual(onboarding.cookies, [], user.subject);
      assert.deepEqual(await statusesOf(browser), { portal: 403, 'administration/users': 403, 'administration/admins': 403, billing: 403 }, user.subject);
    }
    const refusal = await site.browserOf(nora).open('portal');

    assert.match(refusal.body, /<a href="\/team\/organizations">organization page<\/a>/);
    assert.deepEqual(site.pages.work, []);
    assert.deepEqual(site.sessions.switches, []);
  });

  test('Given a user with User access in one organization, Admin access in a second, and an inactive membership in a third, when the user opens the organization page and selects the second organization for the User administration page, then only the two active organizations are offered, and the browser goes to that page with a new session cookie, where only the second organization and its own permissions apply', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);
    const browser = site.browserOf(mia);

    const list = await browser.open('organizations?return_to=/team/administration/users');
    const forms = formsIn(list.body);
    const before = browser.cookieHeader;
    const selected = await browser.submit(formLabelled(forms, 'Globex'));
    const destination = await browser.follow(selected);
    const statuses = await statusesOf(browser, ['portal', 'administration/users']);
    const relisted = formsIn((await browser.open('organizations')).body);

    assertHtmlPage(list);
    assert.deepEqual(forms.map(({ action, label, fields }) => ({ action, label, organization: fields.organization_id, returnTo: fields.return_to })), [
      { action: '/team/organizations/select', label: 'Acme (selected)', organization: 'org-a', returnTo: '/team/administration/users' },
      { action: '/team/organizations/select', label: 'Globex', organization: 'org-b', returnTo: '/team/administration/users' },
    ]);
    assert.equal(selected.status, 303);
    assert.equal(selected.location?.href, 'https://thermus.example/team/administration/users');
    assert.equal(selected.cookies.length, 1);
    assert.notEqual(browser.cookieHeader, before);
    assert.equal(destination.status, 200);
    assert.deepEqual(statuses, { portal: 403, 'administration/users': 200 });
    assert.deepEqual(relisted.map(({ label }) => label), ['Acme', 'Globex (selected)']);
    assert.deepEqual(site.sessions.switches, [{ subject: 'user-mia', organizationId: 'org-b' }]);
    assert.deepEqual(site.pages.work, [
      { path: '/team/administration/users', subject: 'user-mia', tenantId: 'hosted:org-b', organizationId: 'org-b' },
      { path: '/team/administration/users', subject: 'user-mia', tenantId: 'hosted:org-b', organizationId: 'org-b' },
    ]);
  });

  test('Given the same user, when a selection form names an inactive membership, an organization of another user, or an unknown organization, also with forged organization values in the query and headers, then each selection is refused, the session keeps its organization, and the session gets no switch', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);
    const browser = site.browserOf(mia);
    const acme = formLabelled(formsIn((await browser.open('organizations?organizationId=org-d', { 'X-Organization-Id': 'org-d' })).body), 'Acme (selected)');

    const refusals = [];
    for (const organizationId of ['org-c', 'org-d', 'org-unknown']) {
      const forged = { ...acme, action: `${acme.action}?organizationId=${organizationId}`, fields: { ...acme.fields, organization_id: organizationId } };
      refusals.push(await browser.submit(forged, { headers: { 'X-Organization-Id': organizationId } }));
    }
    const portal = await browser.open('portal?organizationId=org-d', { 'X-Organization-Id': 'org-d' });

    for (const refusal of refusals) {
      assert.equal(refusal.status, 403);
      assert.match(refusal.body, /Your account has no access to this organization\./);
      assert.equal(refusal.location, undefined);
    }
    assert.equal(portal.status, 200);
    assert.deepEqual(site.sessions.switches, []);
    assert.deepEqual(site.pages.work, [{ path: '/team/portal', subject: 'user-mia', tenantId: 'hosted:org-a', organizationId: 'org-a' }]);
  });

  test('Given a user with only Super Admin in an organization, when it selects that organization for the billing page, then billing and Admin-grant administration work there, but the product page, User administration, and the protected MCP tool stay refused, and no Admin or User grant is inferred', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);
    const browser = site.browserOf(sam);

    const forms = formsIn((await browser.open('organizations?return_to=/team/billing')).body);
    const selected = await browser.submit(formLabelled(forms, 'Acme'));
    const billing = await browser.follow(selected);
    const administration = await browser.open('administration/admins');
    const statuses = await statusesOf(browser, ['portal', 'administration/users']);
    const tool = await site.callTool('user-sam-token');

    assert.deepEqual(forms.map(({ label }) => label), ['Acme']);
    assert.equal(selected.location?.href, 'https://thermus.example/team/billing');
    assertHtmlPage(billing);
    assert.match(billing.body, /Plan: Free/);
    assert.deepEqual(formsIn(billing.body), []);
    assert.equal(administration.status, 200, administration.body);
    const { context } = JSON.parse(administration.body) as { context: { grants: unknown; permissions: unknown } };
    assert.deepEqual(context.grants, [superAdminGrant]);
    assert.deepEqual(context.permissions, ['admin-grants:manage', 'billing:manage']);
    assert.deepEqual(statuses, { portal: 403, 'administration/users': 403 });
    assert.equal(tool.isError, true);
    assert.deepEqual(tool.content, [{ type: 'text', text: 'Access denied' }]);
    assert.deepEqual(site.tools.work, []);
  });
});
