import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import { composeHostedApplication } from '../../../src/app/application.ts';
import type { AuthenticatedUser, RequestContext } from '../../../src/accounts/identity/access-context.ts';
import type { AccountFailureReport } from '../../../src/interfaces/web/account/account-routes.ts';
import { WorkOSAuthProvider } from '../../../src/accounts/providers/workos/workos-auth-provider.ts';
import { WorkOSBrowserSession } from '../../../src/accounts/providers/workos/workos-browser-session.ts';
import { WorkOSOrganizations } from '../../../src/accounts/providers/workos/workos-organizations.ts';
import { WorkOSSessionRoutes } from '../../../src/interfaces/web/auth/workos/workos-session-routes.ts';
import { workosAuthority } from '../../../src/accounts/providers/workos/workos-settings.ts';
import { BillingFree } from '../../../src/accounts/billing/billing-free.ts';
import { PRODUCT_ACCESS } from '../../../src/interfaces/web/account/portal-access.ts';
import { MCPServer } from '../../../src/interfaces/mcp/mcp-server.ts';
import { OrganizationAdministration } from '../../../src/accounts/organizations/organization-administration.ts';
import { AccountOperationSpy } from '../../support/doubles/hosted-admin/account-operation-spy.ts';
import { formLabelled, formsIn, type HostedBrowser } from '../../support/drivers/browser/hosted-browser.ts';
import { ProtectedToolSpy } from '../../support/doubles/mcp/protected-tool-spy.ts';
import { fakeClientId } from '../../support/doubles/workos/workos-fake-api.ts';
import { signInThroughServer } from '../../support/dsl/workos-sign-in.ts';
import { WorkOSFake, type FakeMembership, type FakeUser } from '../../support/doubles/workos/workos-fake.ts';
import { mcpRequest } from '../../support/drivers/mcp/mcp-http-request.ts';
import { hostedConfig } from '../../support/fixtures/hosted-config.ts';
import { adminGrant, userGrant } from '../../support/fixtures/hosted-roles.ts';

// The real WorkOS session, organization directory, and access resolver with the pinned SDK and a local fake of the
// WorkOS API, together with the real OrganizationAdministration, account routes, and MCP server. A probe stands in for
// the destinations of the account pages, each with its permission, so that the administration access of each role
// shows. These tests do not show what the WorkOS service sends; the hosted live gate does.

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

const mia: FakeUser = { id: 'user_01MIA', email: 'mia@example.com', firstName: 'Mia' };
const otto: FakeUser = { id: 'user_01OTTO', email: 'otto@example.com', firstName: 'Otto' };
const sam: FakeUser = { id: 'user_01SAM', email: 'sam@example.com', firstName: 'Sam' };

// Mia: User in Acme, Admin in Globex, inactive in Initech, and only the default role in Umbrella. Otto: every role in
// Hooli. Sam: only Admin in Acme.
const memberships: readonly FakeMembership[] = [
  { userId: mia.id, organizationId: acme, roles: ['user'] },
  { userId: mia.id, organizationId: globex, roles: ['admin'] },
  { userId: mia.id, organizationId: initech, roles: ['user', 'admin'], status: 'inactive' },
  { userId: mia.id, organizationId: umbrella, roles: [] },
  { userId: otto.id, organizationId: hooli, roles: ['user', 'admin'] },
  { userId: sam.id, organizationId: acme, roles: ['admin'] },
];

async function openSite(t: TestContext) {
  const world = await WorkOSFake.start(t, hostedConfig.publicBaseUrl, Object.keys(organizationNames));
  world.memberships = memberships;
  world.organizationNames = organizationNames;
  const { settings, workos, authkitKeySet } = world.connection();
  const failures: AccountFailureReport[] = [];
  const reportFailure = (report: AccountFailureReport): void => { failures.push(report); };
  const organizations = new WorkOSOrganizations({ authority, userManagement: workos.userManagement, authorization: workos.authorization });
  const provider = new WorkOSAuthProvider({ authority, authkitIssuer: settings.authkitIssuer, mcpResourceUrl: hostedConfig.mcpResourceUrl, keySet: authkitKeySet, grants: organizations });
  const session = new WorkOSBrowserSession({ workos, settings, authority });
  const pages = new AccountOperationSpy(destinations);
  const tools = new ProtectedToolSpy();
  const mcp = new MCPServer({
    auth: { verifier: provider, accessResolver: provider, resourceMetadataUrl: hostedConfig.resourceMetadataUrl, expectedResource: new URL(hostedConfig.mcpResourceUrl), requiredPermission: PRODUCT_ACCESS },
    buildServer: tools.buildServer,
    reportFailure: () => {},
  });
  const browserRoutes = new WorkOSSessionRoutes({ session, publicBaseUrl: hostedConfig.publicBaseUrl, redirectUri: settings.redirectUri, reportFailure });
  const application = composeHostedApplication(
    hostedConfig,
    { session, accessResolver: provider, organizations, mcp, browserRoutes },
    { reportFailure, changeRecords: { record: () => {} }, billing: new BillingFree(), operation: pages.operation },
  );
  t.after(() => application.close());
  const transport = (request: Request): Promise<Response> => application.handle(request);
  return { world, organizations, pages, tools, failures, transport, publicBaseUrl: hostedConfig.publicBaseUrl };
}

type Site = Awaited<ReturnType<typeof openSite>>;

async function signIn(site: Site, user: FakeUser, organizationId?: string): Promise<HostedBrowser> {
  const { browser, callback } = await signInThroughServer(site, user, organizationId);
  assert.equal(callback.status, 303, callback.body);
  return browser;
}

async function select(browser: HostedBrowser, label: string, returnTo: string) {
  const forms = formsIn((await browser.open(`organizations?return_to=${returnTo}`)).body);
  return browser.submit(formLabelled(forms, label));
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
  test('Given a member with only Admin in Acme and password sign-in, when it selects Acme, then current reads permit billing, both administration destinations, the product, and MCP', async (t) => {
    const site = await openSite(t);
    const browser = await signIn(site, sam);

    const selected = await select(browser, 'Acme', '/team/billing');
    const billing = await browser.follow(selected);
    const admins = await contextAt(browser, 'administration/admins');
    const access = [(await browser.open('portal')).status, (await browser.open('administration/users')).status];
    const token = await site.world.connectToken(sam, { org_id: acme });
    const tool = await site.transport(mcpRequest({ url: hostedConfig.mcpResourceUrl, method: 'tools/call', token, params: { name: ProtectedToolSpy.toolName, arguments: { url: 'https://example.com/' } } }));

    assert.equal(selected.location?.href, 'https://thermus.example/team/billing');
    assert.equal(billing.status, 200, billing.body);
    assert.match(billing.body, /Plan: Free/);
    assert.deepEqual([admins.organizationId, admins.tenantId], [acme, `${authority}:${acme}`]);
    assert.deepEqual(admins.grants, [adminGrant]);
    assert.deepEqual(admins.permissions, adminGrant.permissions);
    assert.deepEqual(access, [200, 200]);
    assert.equal(tool.status, 200);
    assert.deepEqual(site.tools.work.map(({ step }) => step), ['fetch', 'clean']);
    assert.deepEqual(site.pages.work.map(({ path }) => path), ['/team/administration/admins', '/team/portal', '/team/administration/users']);
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
    assert.equal(portalInGlobex, 200);
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
    await browser.submit(formLabelled(forms, 'Globex'));
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
    { label: 'the membership of another user', change: (world: WorkOSFake) => world.fake.answer(membershipsRoute, membershipAnswerOf(otto.id, hooli, 'active')) },
    { label: 'an inactive membership', change: (world: WorkOSFake) => world.fake.answer(membershipsRoute, membershipAnswerOf(mia.id, initech, 'inactive')) },
    { label: 'a default role that gives product:access', change: (world: WorkOSFake) => world.fake.answer(`GET /authorization/organizations/${acme}/roles`, permissiveDefaultRoles()) },
  ]) {
    test(`Given WorkOS answers ${label}, when the organization page opens and a selection is posted, then each fails with 500 and an operator report, shows neither an organization nor the onboarding guidance, and switches nothing`, async (t) => {
      const site = await openSite(t);
      const browser = await signIn(site, mia, acme);
      const acmeForm = formLabelled(formsIn((await browser.open('organizations')).body), 'Acme (selected)');
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
  const data = [role('member', ['product:access']), role('user', ['product:access']), role('admin', adminGrant.permissions)];
  return { status: 200, body: { object: 'list', data } };
}
