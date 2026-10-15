import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { composeHostedApplication, type Application } from '../../src/application.ts';
import type { AuthenticatedUser, RequestContext, RoleGrant } from '../../src/auth/access-context.ts';
import type { Billing } from '../../src/billing/billing.ts';
import { BillingFree } from '../../src/billing/billing-free.ts';
import { loadDeploymentConfig } from '../../src/config/deployment-config.ts';
import type { AccountFailureReporter } from '../../src/hosted-admin/account-routes.ts';
import { startHttpServer } from '../../src/http/server.ts';
import type { VerifiedIdentity } from '../../src/auth/identity-verifier.ts';
import { MCPServer } from '../../src/mcp/mcp-server.ts';
import type { ChangeRecord, ChangeRecorder } from '../../src/organizations/change-records.ts';
import { IdentityVerifierMock } from '../unit/mcp/fixtures/identity-verifier-mock.ts';
import { mcpRequest, rpcResult } from '../unit/mcp/fixtures/mcp-http-request.ts';
import { AccountOperationProbe } from './account-operation-probe.ts';
import { BrowserSessionStore, type SignInOptions } from './browser-session-store.ts';
import { HostedBrowser, listenerTransport, type BrowserTransport, type PageForm } from './hosted-browser.ts';
import { MembershipDirectoryDouble, type MembershipRecord } from './membership-directory-double.ts';
import { RequestContextProbe } from './request-context-probe.ts';

export const hostedConfig = loadDeploymentConfig({ DEPLOYMENT: 'hosted', PUBLIC_BASE_URL: 'https://thermus.example/team' }, 'http');
export const userGrant: RoleGrant = { role: 'user', permissions: ['product:access'] };
export const adminGrant: RoleGrant = { role: 'admin', permissions: ['user-grants:manage'] };
export const superAdminGrant: RoleGrant = { role: 'super-admin', permissions: ['admin-grants:manage', 'billing:manage'] };
export const destinationPaths = ['portal', 'administration/users', 'administration/admins', 'billing'];
const authority = 'hosted-provider-double';
const memberRole: RoleGrant = { role: 'member', permissions: [] };
const destinations = new Map([
  ['/team/portal', 'product:access'],
  ['/team/administration/users', 'user-grants:manage'],
  ['/team/administration/admins', 'admin-grants:manage'],
  ['/team/billing', 'billing:manage'],
]);
const organizationNames: Readonly<Record<string, string>> = { 'org-a': 'Acme', 'org-b': 'Globex', 'org-c': 'Initech', 'org-d': 'Umbrella', 'org-e': 'Hooli' };
const nowSeconds = Math.floor(Date.now() / 1_000);

export function userOf(subject: string, selectedOrganizationId?: string): AuthenticatedUser {
  return { authority, subject, ...(selectedOrganizationId === undefined ? {} : { selectedOrganizationId }) };
}

export function member(subject: string, organizationId: string, grants: readonly RoleGrant[]): MembershipRecord {
  return { subject, organizationId, organizationName: organizationNames[organizationId] ?? organizationId, active: true, grants };
}

// nora has no membership. mia is a User in Acme, an Admin in Globex, and inactive in Initech. Umbrella is otto's only.
export const members: readonly MembershipRecord[] = [
  { ...member('user-ivy', 'org-a', [userGrant, adminGrant]), active: false },
  member('user-dora', 'org-a', [memberRole]),
  member('user-mia', 'org-a', [userGrant]),
  member('user-mia', 'org-b', [adminGrant]),
  { ...member('user-mia', 'org-c', [userGrant, adminGrant]), active: false },
  member('user-otto', 'org-d', [userGrant, adminGrant, superAdminGrant]),
  member('user-sam', 'org-a', [superAdminGrant]),
  member('user-una', 'org-a', [userGrant]),
];

export interface SiteSetup {
  readonly reportFailure: AccountFailureReporter;
  // Each of these users has the MCP token "<subject>-token", which carries the organization that the user selected.
  readonly mcpUsers?: readonly AuthenticatedUser[];
  // More MCP tokens, each with the user and the organization that it carries.
  readonly mcpTokens?: ReadonlyMap<string, AuthenticatedUser>;
  // The memberships of the directory. The default is `members`.
  readonly memberships?: readonly MembershipRecord[];
  // Gets each change record too, after the site keeps it in `records`.
  readonly changeRecords?: ChangeRecorder;
  // The billing of the hosted composition. The default is BillingFree.
  readonly billing?: Billing;
}

export interface OrganizationSite {
  readonly application: Application;
  readonly sessions: BrowserSessionStore;
  readonly directory: MembershipDirectoryDouble;
  readonly pages: AccountOperationProbe;
  readonly tools: RequestContextProbe;
  readonly records: readonly ChangeRecord[];
  readonly transport: BrowserTransport;
  browserOf(user: AuthenticatedUser, options?: SignInOptions): HostedBrowser;
  callTool(token: string): Promise<Record<string, unknown>>;
}

// The real hosted composition, account routes, OrganizationAdministration, access contracts, and MCPServer, in this
// process. Doubles stand at the provider boundaries: the browser session, the membership directory, and the MCP token
// verifier. Two test-only probes stand in for the product: AccountOperationProbe gives the destinations, each with
// the permission that it checks, and RequestContextProbe gives the MCP tool, which records its request context. No
// WorkOS setting, SDK, or credential exists.
export function openOrganizationSite(t: TestContext, setup: SiteSetup): OrganizationSite {
  const parts = composeSite(setup);
  t.after(() => parts.application.close());
  return siteWith(parts, parts.application.handle);
}

export async function serveOrganizationSite(t: TestContext, setup: SiteSetup): Promise<OrganizationSite> {
  const parts = composeSite(setup);
  const server = await startHttpServer(parts.application.handle, { listen: { host: '127.0.0.1', port: 0 }, publicBaseUrl: hostedConfig.publicBaseUrl });
  t.after(async () => {
    await server.close();
    await parts.application.close();
  });
  return siteWith(parts, listenerTransport(server.url));
}

export function formFor(forms: readonly PageForm[], label: string): PageForm {
  const form = forms.find((candidate) => candidate.label === label);
  assert.ok(form, `the page offers no selection of ${label}: ${JSON.stringify(forms)}`);
  return form;
}

export async function statusesOf(browser: HostedBrowser, paths: readonly string[] = destinationPaths): Promise<Record<string, number>> {
  const statuses: Record<string, number> = {};
  for (const path of paths) statuses[path] = (await browser.open(path)).status;
  return statuses;
}

export async function contextAt(browser: HostedBrowser, path: string): Promise<RequestContext> {
  const answer = await browser.open(path);
  assert.equal(answer.status, 200, answer.body);
  return (JSON.parse(answer.body) as { context: RequestContext }).context;
}

function composeSite(setup: SiteSetup) {
  const sessions = new BrowserSessionStore();
  const directory = new MembershipDirectoryDouble(authority, setup.memberships ?? members);
  const pages = new AccountOperationProbe(destinations);
  const tools = new RequestContextProbe();
  const records: ChangeRecord[] = [];
  const tokenUsers = [...(setup.mcpUsers ?? []).map((user): [string, AuthenticatedUser] => [`${user.subject}-token`, user]), ...(setup.mcpTokens ?? [])];
  const tokens = new Map(tokenUsers.map(([token, user]) => [token, identityOf(user)]));
  const mcp = new MCPServer({
    auth: { verifier: new IdentityVerifierMock(tokens), accessResolver: directory, resourceMetadataUrl: hostedConfig.resourceMetadataUrl, expectedResource: new URL(hostedConfig.mcpResourceUrl) },
    buildServer: tools.buildServer,
    reportFailure: () => {},
  });
  const application = composeHostedApplication(
    hostedConfig,
    { session: sessions, accessResolver: directory, organizations: directory, mcp },
    {
      reportFailure: setup.reportFailure,
      changeRecords: { record: (entry) => { records.push(entry); setup.changeRecords?.record(entry); } },
      billing: setup.billing ?? new BillingFree(),
      operation: pages.operation,
    },
  );
  return { application, sessions, directory, pages, tools, records };
}

function siteWith(parts: ReturnType<typeof composeSite>, transport: BrowserTransport): OrganizationSite {
  return {
    ...parts,
    transport,
    browserOf: (user, options) => new HostedBrowser(transport, hostedConfig.publicBaseUrl, parts.sessions.signIn(user, options)),
    callTool: async (token) => rpcResult(await transport(mcpRequest({
      url: hostedConfig.mcpResourceUrl,
      method: 'tools/call',
      token,
      params: { name: RequestContextProbe.toolName, arguments: { url: 'https://example.com/', organizationId: 'org-b' } },
      headers: { 'X-Organization-Id': 'org-b' },
    }))),
  };
}

function identityOf(user: AuthenticatedUser): VerifiedIdentity {
  return {
    user,
    issuer: authority,
    clientId: 'mcp-client',
    scopes: ['openid'],
    issuedAtUnixSeconds: nowSeconds - 60,
    expiresAtUnixSeconds: nowSeconds + 3_600,
    resource: new URL(hostedConfig.mcpResourceUrl),
  };
}
