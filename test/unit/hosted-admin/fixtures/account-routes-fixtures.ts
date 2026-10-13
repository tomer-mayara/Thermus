import assert from 'node:assert/strict';
import type { AccessDecision, AuthenticatedUser, RequestContext, RoleGrant } from '../../../../src/auth/access-context.ts';
import { HostedAccountRoutes, type AccountFailureReport } from '../../../../src/hosted-admin/account-routes.ts';
import type { BrowserSessionState } from '../../../../src/auth/hosted-auth/browser-session.ts';
import type { AuthorizedOrganization } from '../../../../src/organizations/organization-administration.ts';
import { AccessResolverMock, type ConfiguredAccess } from '../../mcp/fixtures/access-resolver-mock.ts';
import { AccountOperationDouble, type OperationAnswer } from './account-operation-double.ts';
import { BrowserSessionDouble, SignedInSessionDouble, type ConfiguredSession, type SignedInSetup } from './browser-session-double.ts';
import { OrganizationAdministrationDouble, type AdministrationSetup, type ConfiguredOrganizations } from './organization-administration-double.ts';

export const publicBaseUrl = 'https://thermus.example/';
export const publicOrigin = 'https://thermus.example';
const authority = 'hosted-provider-double';
export const ann: AuthenticatedUser = { authority, subject: 'user-ann', selectedOrganizationId: 'org-a' };
export const ben: AuthenticatedUser = { authority, subject: 'user-ben', selectedOrganizationId: 'org-b' };
export const userGrant: RoleGrant = { role: 'user', permissions: ['product:access'] };
export const adminGrant: RoleGrant = { role: 'admin', permissions: ['user-grants:manage'] };
export const noticeHeaders = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'content-security-policy': "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
};

export interface Setup {
  readonly publicBaseUrl?: string;
  readonly sessions?: ReadonlyMap<string, ConfiguredSession>;
  readonly otherSession?: BrowserSessionState;
  readonly decisions?: ReadonlyMap<string, ConfiguredAccess>;
  readonly organizations?: ReadonlyMap<string, ConfiguredOrganizations>;
  readonly administration?: AdministrationSetup;
  readonly withOperation?: boolean;
  readonly operationAnswer?: OperationAnswer;
}

export function serve(setup: Setup) {
  const session = new BrowserSessionDouble(setup.sessions, setup.otherSession);
  const resolver = new AccessResolverMock(setup.decisions);
  const organizations = new OrganizationAdministrationDouble(setup.organizations, setup.administration);
  const operations = new AccountOperationDouble(setup.operationAnswer);
  const failures: AccountFailureReport[] = [];
  const operation = setup.withOperation === false ? undefined : operations.operation;
  const routes = new HostedAccountRoutes({
    publicBaseUrl: setup.publicBaseUrl ?? publicBaseUrl,
    session,
    accessResolver: resolver,
    organizations,
    reportFailure: (report) => failures.push(report),
    operation,
  });
  return { routes, session, resolver, organizations, operations, failures };
}

export function signedIn(user: AuthenticatedUser, setup: SignedInSetup = {}): SignedInSessionDouble {
  return new SignedInSessionDouble(user, setup);
}

export function contextOf(user: AuthenticatedUser, grants: readonly RoleGrant[], permissions: readonly string[]): RequestContext {
  return { user, tenantId: `tenant-${user.selectedOrganizationId}`, organizationId: user.selectedOrganizationId, grants, permissions };
}

export function allowedFor(context: RequestContext): AccessDecision {
  return { allowed: true, context };
}

export function organization(organizationId: string, organizationName: string, selected = false): AuthorizedOrganization {
  return { organizationId, organizationName, selected };
}

export function accountRequest(path: string, cookie?: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  if (cookie !== undefined) headers.set('Cookie', cookie);
  return new Request(new URL(path, publicBaseUrl), { ...init, headers });
}

export interface FormPost {
  readonly cookie: string;
  readonly body: string;
  readonly headers?: Readonly<Record<string, string>>;
}

export interface ExpectedPage {
  readonly status: number;
  readonly text: RegExp;
  readonly cookies?: readonly string[];
}

export function formPost(path: string, cookie: string, form: string): Request {
  return postForm(path, { cookie, body: form });
}

export function postForm(path: string, post: FormPost): Request {
  return accountRequest(path, post.cookie, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: publicOrigin, ...post.headers },
    body: post.body,
  });
}

export async function assertPage(response: Response, { status, text, cookies = [] }: ExpectedPage): Promise<void> {
  assert.equal(response.status, status);
  assert.deepEqual(response.headers.getSetCookie(), cookies);
  const headers = Object.fromEntries([...response.headers].filter(([name]) => name !== 'set-cookie' && name !== 'allow'));
  assert.deepEqual(headers, noticeHeaders);
  const body = await response.text();
  assert.match(body, text);
  assert.doesNotMatch(body, /<form|<input|<script|<link|<img/i);
}
