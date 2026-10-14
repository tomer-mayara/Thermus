import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import { composeHostedApplication } from '../../../src/application.ts';
import type { AuthenticatedUser, RequestContext } from '../../../src/auth/access-context.ts';
import type { AccountFailureReport } from '../../../src/hosted-admin/account-routes.ts';
import { WorkOSAuthProvider } from '../../../src/auth/hosted-auth/workos/workos-auth-provider.ts';
import { WorkOSBrowserSession } from '../../../src/auth/hosted-auth/workos/workos-browser-session.ts';
import { WorkOSOrganizations } from '../../../src/auth/hosted-auth/workos/workos-organizations.ts';
import { WorkOSSessionRoutes } from '../../../src/auth/hosted-auth/workos/workos-session-routes.ts';
import { workosAuthority } from '../../../src/auth/hosted-auth/workos/workos-settings.ts';
import { BillingFree } from '../../../src/billing/billing-free.ts';
import { loadDeploymentConfig } from '../../../src/config/deployment-config.ts';
import { PRODUCT_ACCESS } from '../../../src/hosted-admin/portal-access.ts';
import { MCPServer } from '../../../src/mcp/mcp-server.ts';
import { OrganizationAdministration } from '../../../src/organizations/organization-administration.ts';
import { AccountOperationProbe } from '../../support/account-operation-probe.ts';
import { formsIn, type HostedBrowser } from '../../support/hosted-browser.ts';
import { adminGrant, formFor, superAdminGrant, userGrant } from '../../support/hosted-organization-site.ts';
import { RequestContextProbe } from '../../support/request-context-probe.ts';
import { fakeClientId } from '../../support/workos-fake-api.ts';
import { signInThroughServer } from '../../support/workos-sign-in.ts';
import { WorkOSWorld, type WorldMembership, type WorldUser } from '../../support/workos-world.ts';
import { mcpRequest } from '../../unit/mcp/fixtures/mcp-http-request.ts';

// The real WorkOS session, organization directory, and access resolver with the pinned SDK and a local fake of the
// WorkOS API, together with the real OrganizationAdministration, account routes, and MCP server. A probe stands in for
// the destinations of the account pages, each with its permission, so that the administration access of each role
// shows. These tests do not show what the WorkOS service sends; the hosted live gate does.

const config = loadDeploymentConfig({ DEPLOYMENT: 'hosted', PUBLIC_BASE_URL: 'https://thermus.example/team' }, 'http');
const authority = workosAuthority(fakeClientId);
const acme = 'org_01ACME';
const globex = 'org_01GLOBEX';
const initech = 'org_01INITECH';
const umbrella = 'org_01UMBRELLA';
const hooli = 'org_01HOOLI';
const organizationNames = { [acme]: 'Acme', [globex]: 'Globex', [initech]: 'Initech', [umbrella]: 'Umbrella', [hooli]: 'Hooli' };
// The billing page is a real administration page of the routes, so the probe has no billing destination.
const destinations = new Map([
  ['/team/portal', 'product:access'],
  ['/team/administration/users', 'user-grants:manage'],
  ['/team/administration/admins', 'admin-grants:manage'],
]);
const membershipsRoute = 'GET /user_management/organization_memberships';

const mia: WorldUser = { id: 'user_01MIA', email: 'mia@example.com', firstName: 'Mia' };
const otto: WorldUser = { id: 'user_01OTTO', email: 'otto@example.com', firstName: 'Otto' };
const sam: WorldUser = { id: 'user_01SAM', email: 'sam@example.com', firstName: 'Sam' };

// Mia: User in Acme, Admin in Globex, inactive in Initech, and only the default role in Umbrella. Otto: every role in
// Hooli. Sam: only Super Admin in Acme.
const memberships: readonly WorldMembership[] = [
  { userId: mia.id, organizationId: acme, roles: ['user'] },
  { userId: mia.id, organizationId: globex, roles: ['admin'] },
  { userId: mia.id, organizationId: initech, roles: ['user', 'admin'], status: 'inactive' },
  { userId: mia.id, organizationId: umbrella, roles: [] },
  { userId: otto.id, organizationId: hooli, roles: ['user', 'admin', 'super-admin'] },
  { userId: sam.id, organizationId: acme, roles: ['super-admin'] },
];

async function openSite(t: TestContext) {
  const world = await WorkOSWorld.start(t, config.publicBaseUrl, Object.keys(organizationNames));
  world.memberships = memberships;
  world.organizationNames = organizationNames;
  const { settings, workos, authkitKeySet } = world.connection();
  const failures: AccountFailureReport[] = [];
  const reportFailure = (report: AccountFailureReport): void => { failures.push(report); };
  const organizations = new WorkOSOrganizations({ authority, userManagement: workos.userManagement, authorization: workos.authorization, organizations: workos.organizations });
  const provider = new WorkOSAuthProvider({ authority, authkitIssuer: settings.authkitIssuer, mcpResourceUrl: config.mcpResourceUrl, keySet: authkitKeySet, grants: organizations });
  const session = new WorkOSBrowserSession({ workos, settings, authority });
  const pages = new AccountOperationProbe(destinations);
  const tools = new RequestContextProbe();
  const mcp = new MCPServer({
    auth: { verifier: provider, accessResolver: provider, resourceMetadataUrl: config.resourceMetadataUrl, expectedResource: new URL(config.mcpResourceUrl), requiredPermission: PRODUCT_ACCESS },
    buildServer: tools.buildServer,
    reportFailure: () => {},
  });
  const browserRoutes = new WorkOSSessionRoutes({ session, publicBaseUrl: config.publicBaseUrl, redirectUri: settings.redirectUri, reportFailure });
  const application = composeHostedApplication(
    config,
    { session, accessResolver: provider, organizations, mcp, browserRoutes },
    { reportFailure, changeRecords: { record: () => {} }, billing: new BillingFree(), operation: pages.operation },
  );
  t.after(() => application.close());
  const transport = (request: Request): Promise<Response> => application.handle(request);
  return { world, organizations, pages, tools, failures, transport, publicBaseUrl: config.publicBaseUrl };
}

type Site = Awaited<ReturnType<typeof openSite>>;

async function signIn(site: Site, user: WorldUser, organizationId?: string): Promise<HostedBrowser> {
  const { browser, callback } = await signInThroughServer(site, user, organizationId);
  assert.equal(callback.status, 303, callback.body);
  return browser;
}

async function select(browser: HostedBrowser, label: string, returnTo: string) {
  const forms = formsIn((await browser.open(`organizations?return_to=${returnTo}`)).body);
  return browser.submit(formFor(forms, label));
}

async function contextAt(browser: HostedBrowser, path: string): Promise<RequestContext> {
  const answer = await browser.open(path);
  assert.equal(answer.status, 200, answer.body);
  return (JSON.parse(answer.body) as { context: RequestContext }).context;
}

// The WorkOS requests of the site, without the reads of the browser key set.
function workosRequests(site: Site): string[] {
  return site.world.fake.takeRequests().map(({ method, path }) => `${method} ${path}`).filter((line) => !line.startsWith('GET /sso/jwks/'));
}

describe('WorkOS organization reads with the real session, organization service, and account routes', () => {
  test('Given a member with only Super Admin in Acme, when it selects Acme for the billing page, then the billing page of the organization service and the Admin-grant destination accept it from a current WorkOS read with exactly the super-admin grant, and the product page, the User administration, and the MCP tool refuse it: no Admin or User grant is inferred', async (t) => {
    const site = await openSite(t);
    const browser = await signIn(site, sam);

    const selected = await select(browser, 'Acme', '/team/billing');
    const billing = await browser.follow(selected);
    const admins = await contextAt(browser, 'administration/admins');
    const refusals = [(await browser.open('portal')).status, (await browser.open('administration/users')).status];
    const token = await site.world.connectToken(sam, { org_id: acme });
    const tool = await site.transport(mcpRequest({ url: config.mcpResourceUrl, method: 'tools/call', token, params: { name: RequestContextProbe.toolName, arguments: { url: 'https://example.com/' } } }));

    assert.equal(selected.location?.href, 'https://thermus.example/team/billing');
    assert.equal(billing.status, 200, billing.body);
    assert.match(billing.body, /Plan: Free/);
    assert.deepEqual([admins.organizationId, admins.tenantId], [acme, `${authority}:${acme}`]);
    assert.deepEqual(admins.grants, [superAdminGrant]);
    assert.deepEqual(admins.permissions, ['admin-grants:manage', 'billing:manage']);
    assert.deepEqual(refusals, [403, 403]);
    assert.equal(tool.status, 403);
    assert.deepEqual(site.tools.work, []);
    assert.deepEqual(site.pages.work.map(({ path }) => path), ['/team/administration/admins']);
  });

  test('Given a member with User in Acme, Admin in Globex, an inactive membership in Initech, and only the default role in Umbrella, when it selects each organization for a destination, then only Acme and Globex are authorized, and each destination, also the billing page, checks the permission of the selected organization only', async (t) => {
    const site = await openSite(t);
    const browser = await signIn(site, mia, acme);

    const offered = formsIn((await browser.open('organizations')).body).map(({ label }) => label);
    const toGlobex = await select(browser, 'Globex', '/team/administration/users');
    const inGlobex = await contextAt(browser, 'administration/users');
    const portalInGlobex = (await browser.open('portal')).status;
    const toAcme = await select(browser, 'Acme', '/team/portal');
    const inAcme = await contextAt(browser, 'portal');
    const usersInAcme = (await browser.open('administration/users')).status;

    assert.deepEqual(offered, ['Acme (selected)', 'Globex']);
    assert.deepEqual([toGlobex.status, toAcme.status], [303, 303]);
    assert.deepEqual([inGlobex.organizationId, inGlobex.grants], [globex, [adminGrant]]);
    assert.equal(portalInGlobex, 403);
    assert.deepEqual([inAcme.organizationId, inAcme.grants], [acme, [userGrant]]);
    assert.equal(usersInAcme, 403);
    assert.equal((await browser.open('billing')).status, 403);
  });

  test('Given the organization page and a selection, when they run, then WorkOS gets one read of the memberships of the session user with the explicit status active and the largest page, one role read for each active organization, and, for the selection, the same current reads before the refresh into the selected organization', async (t) => {
    const site = await openSite(t);
    const browser = await signIn(site, mia, acme);
    const roleRead = (organizationId: string) => `GET /authorization/organizations/${organizationId}/roles`;
    const reads = [`${membershipsRoute}?user_id=${mia.id}&statuses=active&limit=100&order=desc`, roleRead(acme), roleRead(globex), roleRead(umbrella)];
    workosRequests(site);

    const forms = formsIn((await browser.open('organizations')).body);
    const pageRequests = workosRequests(site);
    await browser.submit(formFor(forms, 'Globex'));
    const selectionRequests = workosRequests(site);

    assert.deepEqual(pageRequests, reads);
    assert.deepEqual(selectionRequests, [...reads, 'POST /user_management/authenticate']);
  });

  test('Given the real organization service over the WorkOS reads, when a caller names an organization in the session user or in the request, then only a current active membership with an application permission authorizes it; a user of another authority gets no organization and causes no WorkOS read', async (t) => {
    const site = await openSite(t);
    const service = new OrganizationAdministration({ directory: site.organizations, records: { record: () => {} }, billing: new BillingFree() });
    const forged: AuthenticatedUser = { authority, subject: mia.id, selectedOrganizationId: hooli };

    const listed = await service.listOrganizations(forged);
    const authorized = [];
    for (const organizationId of [acme, globex, initech, umbrella, hooli, 'org_01UNKNOWN']) authorized.push((await service.authorizeSelection(forged, organizationId))?.organizationId);
    workosRequests(site);
    const local = await service.listOrganizations({ authority: 'better-auth:installation-1', subject: mia.id, selectedOrganizationId: acme });

    assert.deepEqual(listed, [
      { organizationId: acme, organizationName: 'Acme', selected: false },
      { organizationId: globex, organizationName: 'Globex', selected: false },
    ]);
    assert.deepEqual(authorized, [acme, globex, undefined, undefined, undefined, undefined]);
    assert.deepEqual(local, []);
    assert.deepEqual(workosRequests(site), []);
  });

  for (const { label, change } of [
    { label: 'the membership of another user', change: (world: WorkOSWorld) => world.fake.answer(membershipsRoute, membershipAnswerOf(otto.id, hooli, 'active')) },
    { label: 'an inactive membership', change: (world: WorkOSWorld) => world.fake.answer(membershipsRoute, membershipAnswerOf(mia.id, initech, 'inactive')) },
    { label: 'a default role that gives product:access', change: (world: WorkOSWorld) => world.fake.answer(`GET /authorization/organizations/${acme}/roles`, permissiveDefaultRoles()) },
  ]) {
    test(`Given WorkOS answers ${label}, when the organization page opens and a selection is posted, then each fails with 500 and an operator report, shows neither an organization nor the onboarding guidance, and switches nothing`, async (t) => {
      const site = await openSite(t);
      const browser = await signIn(site, mia, acme);
      const acmeForm = formFor(formsIn((await browser.open('organizations')).body), 'Acme (selected)');
      change(site.world);
      workosRequests(site);

      const page = await browser.open('organizations');
      const selection = await browser.submit(acmeForm);

      for (const answer of [page, selection]) {
        assert.equal(answer.status, 500, answer.body);
        assert.doesNotMatch(answer.body, /<form|no active access to an organization/);
      }
      assert.deepEqual(site.failures.map(({ path }) => path), ['/team/organizations', '/team/organizations/select']);
      assert.ok(workosRequests(site).every((line) => !line.startsWith('POST /user_management/authenticate')), 'A refused read led to a switch.');
    });
  }
});

function membershipAnswerOf(userId: string, organizationId: string, status: 'active' | 'inactive') {
  const membership = {
    object: 'organization_membership', id: 'om_99', user_id: userId, organization_id: organizationId, organization_name: 'Answered', status,
    directory_managed: false, role: { slug: 'user' }, roles: [{ slug: 'user' }], custom_attributes: {},
    created_at: '2026-10-01T08:00:00.000Z', updated_at: '2026-10-13T08:00:00.000Z',
  };
  return { status: 200, body: { object: 'list', data: [membership], list_metadata: { before: null, after: null } } };
}

function permissiveDefaultRoles() {
  const role = (slug: string, permissions: readonly string[]) => ({
    object: 'role', id: `role_01${slug.toUpperCase().replace('-', '')}`, name: slug, slug, description: null, permissions, type: 'EnvironmentRole',
    created_at: '2026-10-01T08:00:00.000Z', updated_at: '2026-10-01T08:00:00.000Z',
  });
  const data = [role('member', ['product:access']), role('user', ['product:access']), role('admin', ['user-grants:manage']), role('super-admin', ['admin-grants:manage', 'billing:manage'])];
  return { status: 200, body: { object: 'list', data } };
}
