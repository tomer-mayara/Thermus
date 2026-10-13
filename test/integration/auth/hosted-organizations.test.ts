import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import { accountFailureReporter, composeHostedApplication, createApplication } from '../../../src/application.ts';
import type { AuthenticatedUser, RequestContext, RoleGrant } from '../../../src/auth/access-context.ts';
import { loadDeploymentConfig } from '../../../src/config/deployment-config.ts';
import type { VerifiedIdentity } from '../../../src/mcp/identity-verifier.ts';
import { MCPServer } from '../../../src/mcp/mcp-server.ts';
import { AccountOperationProbe } from '../../support/account-operation-probe.ts';
import { BrowserSessionStore } from '../../support/browser-session-store.ts';
import { formsIn, HostedBrowser, type PageForm } from '../../support/hosted-browser.ts';
import { unavailableNotice } from '../../support/hosted-placeholder.ts';
import { MembershipDirectoryDouble, type MembershipRecord } from '../../support/membership-directory-double.ts';
import { RequestContextProbe, type ProbeReport } from '../../support/request-context-probe.ts';
import { IdentityVerifierMock } from '../../unit/mcp/fixtures/identity-verifier-mock.ts';
import { mcpRequest, rpcResult } from '../../unit/mcp/fixtures/mcp-http-request.ts';

const config = loadDeploymentConfig({ DEPLOYMENT: 'hosted', PUBLIC_BASE_URL: 'https://magumagu.example/team' }, 'http');
const authority = 'hosted-provider-double';
const userGrant: RoleGrant = { role: 'user', permissions: ['product:access'] };
const adminGrant: RoleGrant = { role: 'admin', permissions: ['user-grants:manage'] };
const superAdminGrant: RoleGrant = { role: 'super-admin', permissions: ['admin-grants:manage', 'billing:manage'] };
const destinations = new Map([
  ['/team/portal', 'product:access'],
  ['/team/administration/users', 'user-grants:manage'],
  ['/team/administration/admins', 'admin-grants:manage'],
  ['/team/billing', 'billing:manage'],
]);
const destinationPaths = ['portal', 'administration/users', 'administration/admins', 'billing'];
const nowSeconds = Math.floor(Date.now() / 1_000);
const organizationNames: Readonly<Record<string, string>> = { 'org-a': 'Acme', 'org-b': 'Globex', 'org-d': 'Umbrella', 'org-e': 'Hooli' };

const memberships: readonly MembershipRecord[] = [
  { ...member('user-ivy', 'org-a', [userGrant]), active: false },
  member('user-mia', 'org-a', [userGrant]),
  member('user-mia', 'org-b', [userGrant, adminGrant]),
  member('user-otto', 'org-d', [userGrant, adminGrant]),
  member('user-sam', 'org-a', [superAdminGrant]),
  member('user-una', 'org-a', [userGrant]),
];

function userOf(subject: string, selectedOrganizationId?: string): AuthenticatedUser {
  return { authority, subject, ...(selectedOrganizationId === undefined ? {} : { selectedOrganizationId }) };
}

function member(subject: string, organizationId: string, grants: readonly RoleGrant[]): MembershipRecord {
  return { subject, organizationId, organizationName: organizationNames[organizationId] ?? organizationId, active: true, grants };
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

class RecordingLogger {
  readonly lines: string[] = [];
  readonly info = (message: string): void => { this.lines.push(`INFO ${message}`); };
  readonly error = (message: string): void => { this.lines.push(`ERROR ${message}`); };
}

// The real hosted composition, account routes, OrganizationAdministration, access contracts, and MCPServer. Doubles
// stand only at the provider boundaries: the browser session, the membership directory, and the MCP token verifier.
function compose(t: TestContext) {
  const sessions = new BrowserSessionStore();
  const directory = new MembershipDirectoryDouble(authority, memberships);
  const pages = new AccountOperationProbe(destinations);
  const tools = new RequestContextProbe();
  const logger = new RecordingLogger();
  const tokens = new Map(['user-mia', 'user-sam', 'user-una'].map((subject) => [`${subject}-token`, identityOf(userOf(subject, 'org-a'))]));
  const mcp = new MCPServer({
    auth: { verifier: new IdentityVerifierMock(tokens), accessResolver: directory, resourceMetadataUrl: config.resourceMetadataUrl, expectedResource: new URL(config.mcpResourceUrl) },
    registerTools: tools.register,
    reportFailure: () => {},
  });
  const application = composeHostedApplication(
    config,
    { session: sessions, accessResolver: directory, organizations: directory, mcp },
    { reportFailure: accountFailureReporter(logger), operation: pages.operation },
  );
  t.after(() => application.close());
  const browserOf = (user: AuthenticatedUser): HostedBrowser => new HostedBrowser(application.handle, config.publicBaseUrl, sessions.signIn(user));
  const callTool = async (token: string) => rpcResult(await application.handle(mcpRequest({
    url: config.mcpResourceUrl,
    method: 'tools/call',
    token,
    params: { name: RequestContextProbe.toolName, arguments: { url: 'https://example.com/', organizationId: 'org-b' } },
    headers: { 'X-Organization-Id': 'org-b' },
  })));
  return { sessions, directory, pages, tools, logger, browserOf, callTool };
}

function formFor(forms: readonly PageForm[], label: string): PageForm {
  const form = forms.find((candidate) => candidate.label === label);
  assert.ok(form, `no selection of ${label}: ${JSON.stringify(forms)}`);
  return form;
}

async function select(browser: HostedBrowser, label: string, returnTo = '/team/organizations') {
  const forms = formsIn((await browser.open(`organizations?return_to=${returnTo}`)).body);
  return browser.submit(formFor(forms, label));
}

async function contextAt(browser: HostedBrowser, path: string): Promise<RequestContext> {
  const answer = await browser.open(path);
  assert.equal(answer.status, 200, answer.body);
  return (JSON.parse(answer.body) as { context: RequestContext }).context;
}

async function statusesOf(browser: HostedBrowser): Promise<Record<string, number>> {
  const statuses: Record<string, number> = {};
  for (const path of destinationPaths) statuses[path] = (await browser.open(path)).status;
  return statuses;
}

describe('Hosted organization onboarding and selection with the real routes and service, and provider doubles', () => {
  test('Given a session that selected an organization where the membership is inactive, when the organization page and the tenant pages are requested, then the guidance comes from a directory read of the session user only, and each tenant page is refused by current access resolution, with no context, tenant, or role', async (t) => {
    const { directory, pages, browserOf } = compose(t);
    const ivy = userOf('user-ivy', 'org-a');
    const browser = browserOf(ivy);

    const onboarding = await browser.open('organizations?organizationId=org-b', { 'X-Organization-Id': 'org-b' });
    const statuses = await statusesOf(browser);

    assert.equal(onboarding.status, 200);
    assert.match(onboarding.body, /accept the invitation/);
    assert.match(onboarding.body, /contact the operator/);
    assert.doesNotMatch(onboarding.body, /<form|hosted:|org-/);
    assert.deepEqual(directory.membershipReads, [ivy]);
    assert.deepEqual(statuses, { portal: 403, 'administration/users': 403, 'administration/admins': 403, billing: 403 });
    assert.deepEqual(directory.calls, destinationPaths.map(() => ivy));
    assert.deepEqual(pages.work, []);
  });

  test('Given memberships that change after the page was shown — one deactivated and one new —, when the user selects each, then the current read decides: the deactivated organization is refused without a switch, and the new one is selected, where the destination checks the current permission', async (t) => {
    const { sessions, directory, pages, browserOf } = compose(t);
    const browser = browserOf(userOf('user-mia', 'org-a'));
    const shown = formsIn((await browser.open('organizations')).body);

    directory.replaceMemberships(memberships.map((record) => (record.organizationId === 'org-b' ? { ...record, active: false } : record))
      .concat(member('user-mia', 'org-e', [userGrant])));
    const refused = await browser.submit(formFor(shown, 'Globex'));
    const selected = await select(browser, 'Hooli', '/team/portal');
    const portal = await contextAt(browser, 'portal');

    assert.deepEqual(shown.map(({ label }) => label), ['Acme (selected)', 'Globex']);
    assert.equal(refused.status, 403);
    assert.equal(selected.location?.href, 'https://magumagu.example/team/portal');
    assert.deepEqual([portal.organizationId, portal.tenantId, portal.permissions], ['org-e', 'hosted:org-e', ['product:access']]);
    assert.deepEqual(sessions.switches, [{ subject: 'user-mia', organizationId: 'org-e' }]);
    assert.deepEqual(pages.work.map(({ organizationId }) => organizationId), ['org-e']);
  });

  test('Given a browser session and an MCP token of the same user in one organization, when the browser selects another organization, then only that browser session changes: the MCP token and a second browser session keep their organization', async (t) => {
    const { browserOf, callTool } = compose(t);
    const mia = userOf('user-mia', 'org-a');
    const browser = browserOf(mia);
    const otherBrowser = browserOf(mia);

    const selected = await select(browser, 'Globex', '/team/administration/users');
    const switched = await contextAt(browser, 'administration/users');
    const tool = await callTool('user-mia-token');
    const other = await contextAt(otherBrowser, 'portal');

    assert.equal(selected.status, 303);
    assert.equal(switched.organizationId, 'org-b');
    assert.notEqual(tool.isError, true, JSON.stringify(tool.content));
    const [content] = tool.content as Array<{ text: string }>;
    const report = JSON.parse(content?.text ?? '{}') as ProbeReport;
    assert.deepEqual([report.context.organizationId, report.context.tenantId], ['org-a', 'hosted:org-a']);
    assert.equal(other.organizationId, 'org-a');
  });

  test('Given two users in different organizations, when one posts selections of the other user\'s organization with forged organization values in the query, the headers, and a second form field, then only the memberships of the session user are read, no selection passes, no session switches, and the other user keeps its organization', async (t) => {
    const { sessions, directory, browserOf } = compose(t);
    const mia = userOf('user-mia', 'org-a');
    const browser = browserOf(mia);
    const otto = browserOf(userOf('user-otto', 'org-d'));
    const acme = formFor(formsIn((await browser.open('organizations')).body), 'Acme (selected)');
    const forged = new URLSearchParams({ ...acme.fields, organization_id: 'org-d' });
    const doubled = new URLSearchParams(acme.fields);
    doubled.append('organization_id', 'org-d');

    const refused = await browser.post('organizations/select?organizationId=org-d', forged.toString(), { headers: { 'X-Organization-Id': 'org-d' } });
    const rejected = await browser.post('organizations/select', doubled.toString());
    const ottoContext = await contextAt(otto, 'administration/users');
    const miaContext = await contextAt(browser, 'portal');

    assert.deepEqual([refused.status, rejected.status], [403, 400]);
    assert.deepEqual(directory.membershipReads, [mia, mia]);
    assert.deepEqual(sessions.switches, []);
    assert.deepEqual([ottoContext.organizationId, miaContext.organizationId], ['org-d', 'org-a']);
  });

  test('Given Super Admin alone and User alone in the same organization, when each selects it and requests each destination and the MCP tool, then each destination and the tool check their own permission: Super Admin reaches only Admin-grant administration and billing, and User reaches only the product and the tool', async (t) => {
    const { browserOf, callTool, tools } = compose(t);

    const outcomes: Record<string, unknown> = {};
    for (const subject of ['user-sam', 'user-una']) {
      const browser = browserOf(userOf(subject));
      assert.equal((await select(browser, 'Acme', '/team/portal')).status, 303, subject);
      const tool = await callTool(`${subject}-token`);
      outcomes[subject] = { ...(await statusesOf(browser)), tool: tool.isError === true ? 'refused' : 'done' };
    }

    assert.deepEqual(outcomes, {
      'user-sam': { portal: 403, 'administration/users': 403, 'administration/admins': 200, billing: 200, tool: 'refused' },
      'user-una': { portal: 200, 'administration/users': 403, 'administration/admins': 403, billing: 403, tool: 'done' },
    });
    assert.deepEqual(tools.contexts.map(({ user, grants }) => [user.subject, grants]), [['user-sam', [superAdminGrant]], ['user-una', [userGrant]]]);
  });

  test('Given an outage of the organization reads after the provider refreshed the session, when the organization page and a selection are requested, then each gets the failure page with the refreshed session cookie, the operator log names the path and the cause, no session switches, and the browser keeps its session', async (t) => {
    const { sessions, directory, logger, browserOf } = compose(t);
    const browser = browserOf(userOf('user-mia', 'org-a'));
    const acme = formFor(formsIn((await browser.open('organizations')).body), 'Acme (selected)');

    directory.failMembershipReads(new Error('organization directory timed out'));
    const answers = [];
    for (const send of [() => browser.open('organizations'), () => browser.submit(acme)]) {
      sessions.expireAccessToken(browser.cookieHeader);
      answers.push(await send());
    }
    directory.failMembershipReads(undefined);
    const after = await browser.open('portal');

    for (const answer of answers) {
      assert.equal(answer.status, 500);
      assert.match(answer.body, /The request failed\. Try again later\./);
      assert.equal(answer.cookies.length, 1, 'the refreshed session cookie is missing');
    }
    assert.deepEqual(logger.lines, [
      'ERROR An account request failed unexpectedly for /team/organizations: Error: organization directory timed out',
      'ERROR An account request failed unexpectedly for /team/organizations/select: Error: organization directory timed out',
    ]);
    assert.deepEqual(sessions.switches, []);
    assert.equal(after.status, 200);
  });

  test('Given the production hosted application with the unavailable placeholder, when the organization page and a selection arrive with the session cookie, form token, and organization values of the doubles, then each gets the 503 notice without a cookie, and nothing is selected or reported', async () => {
    const logger = new RecordingLogger();
    const application = await createApplication(config, logger);
    const sessions = new BrowserSessionStore();
    const browser = new HostedBrowser(application.handle, config.publicBaseUrl, sessions.signIn(userOf('user-mia', 'org-a')));

    const answers = [
      await browser.open('organizations?return_to=/team/portal'),
      await browser.post('organizations/select', { csrf_token: 'forged-token', organization_id: 'org-a', return_to: '/team/portal' }),
      await browser.open('portal'),
    ];
    await application.close();

    for (const answer of answers) {
      assert.equal(answer.status, 503);
      assert.match(answer.body, unavailableNotice);
      assert.deepEqual(answer.cookies, []);
      assert.doesNotMatch(answer.body, /<form/);
    }
    assert.deepEqual(sessions.lookups, []);
    assert.deepEqual(logger.lines, ['INFO Hosted authentication is not available yet. Each hosted request gets the authentication-unavailable notice.']);
  });
});
