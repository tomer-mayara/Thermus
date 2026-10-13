import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import { composeHostedApplication } from '../../../src/application.ts';
import type { AuthenticatedUser, RoleGrant } from '../../../src/auth/access-context.ts';
import { loadDeploymentConfig } from '../../../src/config/deployment-config.ts';
import type { AccountFailureReport } from '../../../src/hosted-admin/account-routes.ts';
import { startHttpServer } from '../../../src/http/server.ts';
import type { VerifiedIdentity } from '../../../src/mcp/identity-verifier.ts';
import { MCPServer } from '../../../src/mcp/mcp-server.ts';
import { AccountOperationProbe } from '../../support/account-operation-probe.ts';
import { BrowserSessionStore, CLEARED_SESSION_COOKIE } from '../../support/browser-session-store.ts';
import { formsIn, HostedBrowser, type BrowserAnswer, type PageForm } from '../../support/hosted-browser.ts';
import { MembershipDirectoryDouble, type MembershipRecord } from '../../support/membership-directory-double.ts';
import { RequestContextProbe } from '../../support/request-context-probe.ts';
import { IdentityVerifierMock } from '../../unit/mcp/fixtures/identity-verifier-mock.ts';
import { mcpRequest, rpcResult } from '../../unit/mcp/fixtures/mcp-http-request.ts';

const config = loadDeploymentConfig({ DEPLOYMENT: 'hosted', PUBLIC_BASE_URL: 'https://magumagu.example/team' }, 'http');
const authority = 'hosted-provider-double';
const userGrant: RoleGrant = { role: 'user', permissions: ['product:access'] };
const adminGrant: RoleGrant = { role: 'admin', permissions: ['user-grants:manage'] };
const superAdminGrant: RoleGrant = { role: 'super-admin', permissions: ['admin-grants:manage', 'billing:manage'] };
const memberRole: RoleGrant = { role: 'member', permissions: [] };
// The destinations of a selection. Each one is a test-only account operation that checks its own permission.
const destinations = new Map([
  ['/team/portal', 'product:access'],
  ['/team/administration/users', 'user-grants:manage'],
  ['/team/administration/admins', 'admin-grants:manage'],
  ['/team/billing', 'billing:manage'],
]);
const nowSeconds = Math.floor(Date.now() / 1_000);

const nora = userOf('user-nora');
const ivy = userOf('user-ivy', 'org-a');
const dora = userOf('user-dora', 'org-a');
const mia = userOf('user-mia', 'org-a');
const sam = userOf('user-sam');
const memberships: readonly MembershipRecord[] = [
  { ...member('user-ivy', 'org-a', [userGrant, adminGrant]), active: false },
  member('user-dora', 'org-a', [memberRole]),
  member('user-mia', 'org-a', [userGrant]),
  member('user-mia', 'org-b', [adminGrant]),
  { ...member('user-mia', 'org-c', [userGrant, adminGrant]), active: false },
  member('user-otto', 'org-d', [userGrant, adminGrant, superAdminGrant]),
  member('user-sam', 'org-a', [superAdminGrant]),
];

function userOf(subject: string, selectedOrganizationId?: string): AuthenticatedUser {
  return { authority, subject, ...(selectedOrganizationId === undefined ? {} : { selectedOrganizationId }) };
}

function member(subject: string, organizationId: string, grants: readonly RoleGrant[]): MembershipRecord {
  const organizationName = { 'org-a': 'Acme', 'org-b': 'Globex', 'org-c': 'Initech', 'org-d': 'Umbrella' }[organizationId] ?? organizationId;
  return { subject, organizationId, organizationName, active: true, grants };
}

function identityOf(user: AuthenticatedUser): VerifiedIdentity {
  return {
    user,
    issuer: authority,
    clientId: 'mcp-client',
    scopes: ['openid'],
    issuedAtUnixSeconds: nowSeconds - 60,
    expiresAtUnixSeconds: nowSeconds + 3_600,
    resource: new URL(config.mcpResourceUrl),
  };
}

// The real hosted composition and HTTP server, with doubles only at the provider boundaries: the browser session, the
// membership directory, and the MCP token verifier. No WorkOS setting, SDK, or credential exists.
async function startFixture(t: TestContext) {
  const sessions = new BrowserSessionStore();
  const directory = new MembershipDirectoryDouble(authority, memberships);
  const pages = new AccountOperationProbe(destinations);
  const tools = new RequestContextProbe();
  const failures: AccountFailureReport[] = [];
  const mcp = new MCPServer({
    auth: {
      verifier: new IdentityVerifierMock(new Map([['sam-token', identityOf(userOf('user-sam', 'org-a'))]])),
      accessResolver: directory,
      resourceMetadataUrl: config.resourceMetadataUrl,
      expectedResource: new URL(config.mcpResourceUrl),
    },
    registerTools: tools.register,
    reportFailure: () => {},
  });
  const application = composeHostedApplication(
    config,
    { session: sessions, accessResolver: directory, organizations: directory, mcp },
    { reportFailure: (report) => failures.push(report), operation: pages.operation },
  );
  const server = await startHttpServer(application.handle, { listen: { host: '127.0.0.1', port: 0 }, publicBaseUrl: config.publicBaseUrl });
  t.after(async () => {
    await server.close();
    await application.close();
  });
  const browserOf = (user: AuthenticatedUser): HostedBrowser => new HostedBrowser(server.url, config.publicBaseUrl, sessions.signIn(user));
  const callTool = async (token: string) => {
    const request = mcpRequest({ url: new URL('team/mcp', server.url).href, method: 'tools/call', token, params: { name: RequestContextProbe.toolName, arguments: { url: 'https://example.com/' } } });
    return rpcResult(await fetch(request));
  };
  return { sessions, directory, pages, tools, failures, server, browserOf, callTool };
}

function selectionOf(forms: readonly PageForm[], label: string): PageForm {
  const form = forms.find((candidate) => candidate.label === label);
  assert.ok(form, `the page offers no selection of ${label}: ${JSON.stringify(forms)}`);
  return form;
}

async function statusesOf(browser: HostedBrowser, paths: readonly string[]): Promise<Record<string, number>> {
  const statuses: Record<string, number> = {};
  for (const path of paths) statuses[path] = (await browser.open(path)).status;
  return statuses;
}

function assertHtmlPage(answer: BrowserAnswer): void {
  assert.equal(answer.status, 200, answer.body);
  assert.match(String(answer.headers['content-type']), /^text\/html/);
  assert.equal(answer.headers['cache-control'], 'no-store');
}

describe('Hosted organization onboarding and selection through the public routes, with session and directory doubles', () => {
  test('Given signed-in users without an authorized active organization — no membership, an inactive membership, or a membership whose role grants no application permission —, when each opens the organization page, then it tells them to accept an invitation or to contact the operator, offers no organization, and every tenant page stays refused without a default tenant or role', { timeout: 20_000 }, async (t) => {
    const fixture = await startFixture(t);

    for (const user of [nora, ivy, dora]) {
      const browser = fixture.browserOf(user);
      const onboarding = await browser.open('organizations');

      assertHtmlPage(onboarding);
      assert.match(onboarding.body, /accept the invitation/, user.subject);
      assert.match(onboarding.body, /contact the operator/, user.subject);
      assert.deepEqual(formsIn(onboarding.body), [], user.subject);
      assert.deepEqual(onboarding.cookies, [], user.subject);
      assert.deepEqual(await statusesOf(browser, ['portal', 'administration/users', 'administration/admins', 'billing']), {
        portal: 403, 'administration/users': 403, 'administration/admins': 403, billing: 403,
      }, user.subject);
    }

    assert.deepEqual(fixture.pages.work, []);
    assert.deepEqual(fixture.sessions.switches, []);
  });

  test('Given a user with User access in one organization, Admin access in a second, and an inactive membership in a third, when the user opens the organization page and selects the second organization for the User administration page, then only the two active organizations are offered, and the browser goes to that page with a new session cookie, where only the second organization and its own permissions apply', { timeout: 20_000 }, async (t) => {
    const fixture = await startFixture(t);
    const browser = fixture.browserOf(mia);

    const list = await browser.open('organizations?return_to=/team/administration/users');
    const forms = formsIn(list.body);
    const before = browser.cookieHeader;
    const selected = await browser.submit(selectionOf(forms, 'Globex'));
    const destination = await browser.follow(selected);
    const statuses = await statusesOf(browser, ['portal', 'administration/users']);
    const relisted = formsIn((await browser.open('organizations')).body);

    assertHtmlPage(list);
    assert.deepEqual(forms.map(({ action, label, fields }) => ({ action, label, organization: fields.organization_id, returnTo: fields.return_to })), [
      { action: '/team/organizations/select', label: 'Acme (selected)', organization: 'org-a', returnTo: '/team/administration/users' },
      { action: '/team/organizations/select', label: 'Globex', organization: 'org-b', returnTo: '/team/administration/users' },
    ]);
    assert.equal(selected.status, 303);
    assert.equal(selected.location?.href, 'https://magumagu.example/team/administration/users');
    assert.equal(selected.cookies.length, 1);
    assert.notEqual(browser.cookieHeader, before);
    assert.equal(destination.status, 200);
    assert.deepEqual(statuses, { portal: 403, 'administration/users': 200 });
    assert.deepEqual(relisted.map(({ label }) => label), ['Acme', 'Globex (selected)']);
    assert.deepEqual(fixture.sessions.switches, [{ subject: 'user-mia', organizationId: 'org-b' }]);
    assert.deepEqual(fixture.pages.work, [
      { path: '/team/administration/users', subject: 'user-mia', tenantId: 'hosted:org-b', organizationId: 'org-b' },
      { path: '/team/administration/users', subject: 'user-mia', tenantId: 'hosted:org-b', organizationId: 'org-b' },
    ]);
  });

  test('Given the same user, when a selection form names an inactive membership, an organization of another user, or an unknown organization, also with forged organization values in the query and headers, then each selection is refused, the session keeps its organization, and the session gets no switch', { timeout: 20_000 }, async (t) => {
    const fixture = await startFixture(t);
    const browser = fixture.browserOf(mia);
    const acme = selectionOf(formsIn((await browser.open('organizations?organizationId=org-d', { 'X-Organization-Id': 'org-d' })).body), 'Acme (selected)');

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
    assert.deepEqual(fixture.sessions.switches, []);
    assert.deepEqual(fixture.pages.work, [{ path: '/team/portal', subject: 'user-mia', tenantId: 'hosted:org-a', organizationId: 'org-a' }]);
  });

  test('Given a user with only Super Admin in an organization, when it selects that organization for the billing page, then billing and Admin-grant administration work there, but the product page, User administration, and the protected MCP tool stay refused, and no Admin or User grant is inferred', { timeout: 20_000 }, async (t) => {
    const fixture = await startFixture(t);
    const browser = fixture.browserOf(sam);

    const forms = formsIn((await browser.open('organizations?return_to=/team/billing')).body);
    const selected = await browser.submit(selectionOf(forms, 'Acme'));
    const billing = await browser.follow(selected);
    const statuses = await statusesOf(browser, ['administration/admins', 'portal', 'administration/users']);
    const tool = await fixture.callTool('sam-token');

    assert.deepEqual(forms.map(({ label }) => label), ['Acme']);
    assert.equal(selected.location?.href, 'https://magumagu.example/team/billing');
    assert.equal(billing.status, 200);
    const { context } = JSON.parse(billing.body) as { context: { grants: unknown; permissions: unknown } };
    assert.deepEqual(context.grants, [superAdminGrant]);
    assert.deepEqual(context.permissions, ['admin-grants:manage', 'billing:manage']);
    assert.deepEqual(statuses, { 'administration/admins': 200, portal: 403, 'administration/users': 403 });
    assert.equal(tool.isError, true);
    assert.deepEqual(tool.content, [{ type: 'text', text: 'Access denied' }]);
    assert.deepEqual(fixture.tools.work, []);
  });

  test('Given a signed-in user whose session the provider refreshes at each request, when selection posts come from another site or without an origin, lack the form token or have a wrong one, or name an invalid return destination or an extra field, then each is refused without a switch, and the refreshed session cookie still reaches the browser', { timeout: 20_000 }, async (t) => {
    const fixture = await startFixture(t);
    const browser = fixture.browserOf(mia);
    const { csrf_token: _token, ...withoutToken } = selectionOf(formsIn((await browser.open('organizations')).body), 'Globex').fields;
    const fields = { ...withoutToken, csrf_token: _token as string };
    const posts: ReadonlyArray<[string, Readonly<Record<string, string>>, { origin?: string | null }, number]> = [
      ['a foreign origin', fields, { origin: 'https://evil.example' }, 403],
      ['no origin', fields, { origin: null }, 403],
      ['no form token', withoutToken, {}, 403],
      ['a wrong form token', { ...fields, csrf_token: 'forged-token' }, {}, 403],
      ['an absolute return destination', { ...fields, return_to: 'https://evil.example/team/' }, {}, 400],
      ['a return destination for another host', { ...fields, return_to: '//evil.example/team/' }, {}, 400],
      ['a return destination outside the public path', { ...fields, return_to: '/team/../admin' }, {}, 400],
      ['an organization name to change', { ...fields, organization_name: 'Renamed' }, {}, 400],
    ];

    for (const [label, form, options, status] of posts) {
      fixture.sessions.expireAccessToken(browser.cookieHeader);
      const before = browser.cookieHeader;
      const answer = await browser.post('organizations/select', form, options);
      assert.equal(answer.status, status, label);
      assert.equal(answer.location, undefined, label);
      assert.equal(answer.cookies.length, 1, `${label}: the refreshed session cookie is missing`);
      assert.notEqual(browser.cookieHeader, before, label);
    }
    fixture.sessions.expireAccessToken(browser.cookieHeader);
    const selected = await browser.post('organizations/select', fields);
    const destination = await browser.follow(selected);

    assert.equal(selected.status, 303);
    assert.equal(selected.cookies.length, 2, 'the answer has the refreshed cookie and then the cookie of the switch');
    assert.equal(destination.status, 200, 'the browser kept the session of the switch');
    assert.deepEqual(fixture.sessions.switches, [{ subject: 'user-mia', organizationId: 'org-b' }]);
  });

  test('Given an ended session and then an outage of the session lookup, when the organization page and a selection are requested, then the ended session gets a sign-in request that clears its cookie, the outage gets a server failure that keeps the cookie and asks for no sign-in, and no organization is read or switched', { timeout: 20_000 }, async (t) => {
    const fixture = await startFixture(t);
    const ended = new HostedBrowser(fixture.server.url, config.publicBaseUrl, 'session=ended-session');
    const browser = fixture.browserOf(mia);
    const [acme] = formsIn((await browser.open('organizations')).body);
    const readsBefore = fixture.directory.membershipReads.length;

    const signedOut = await ended.open('organizations');
    fixture.sessions.failLookups(new Error('session provider timed out'));
    const outages = [await browser.open('organizations'), await browser.submit(acme as PageForm)];
    fixture.sessions.failLookups(undefined);
    const after = await browser.open('portal');

    assert.equal(signedOut.status, 401);
    assert.match(signedOut.body, /Sign in to use this page\./);
    assert.deepEqual(signedOut.cookies, [CLEARED_SESSION_COOKIE]);
    for (const outage of outages) {
      assert.equal(outage.status, 500);
      assert.deepEqual(outage.cookies, []);
      assert.doesNotMatch(outage.body, /Sign in/);
    }
    assert.equal(after.status, 200, 'the outage kept the session');
    assert.equal(fixture.directory.membershipReads.length, readsBefore);
    assert.deepEqual(fixture.sessions.switches, []);
  });

  test('Given a signed-in Super Admin, when it requests to create, resume, rename, or change the settings of an organization, then no route does it: the organization page accepts only GET, the selection accepts no other field, and the session gets no switch', { timeout: 20_000 }, async (t) => {
    const fixture = await startFixture(t);
    const browser = fixture.browserOf(sam);
    const [acme] = formsIn((await browser.open('organizations')).body);

    const create = await browser.post('organizations', { name: 'New organization' });
    const changes = [];
    const extras: ReadonlyArray<Readonly<Record<string, string>>> = [{ organization_name: 'Renamed' }, { settings: 'changed' }, { resume: 'operation-1' }];
    for (const extra of extras) {
      changes.push((await browser.post('organizations/select', { ...(acme as PageForm).fields, ...extra })).status);
    }
    const others = await statusesOf(browser, ['organizations/new', 'organizations/settings', 'organizations/resume']);

    assert.equal(create.status, 405);
    assert.equal(create.headers.allow, 'GET');
    assert.deepEqual(changes, [400, 400, 400]);
    assert.deepEqual(others, { 'organizations/new': 403, 'organizations/settings': 403, 'organizations/resume': 403 });
    assert.deepEqual(fixture.sessions.switches, []);
    assert.deepEqual(fixture.failures, []);
  });
});
