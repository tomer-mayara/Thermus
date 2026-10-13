import assert from 'node:assert/strict';
import type { AccessDecision, AuthenticatedUser, RequestContext, RoleGrant } from '../../../../src/auth/access-context.ts';
import { HostedAccountRoutes } from '../../../../src/hosted-admin/account-routes.ts';
import type { BrowserSessionState } from '../../../../src/hosted-admin/browser-session.ts';
import { AccessResolverMock, type ConfiguredAccess } from '../../mcp/fixtures/access-resolver-mock.ts';
import { AccountOperationDouble } from './account-operation-double.ts';
import { BrowserSessionDouble, SignedInSessionDouble, type ConfiguredSession, type SignedInSetup } from './browser-session-double.ts';

const publicBaseUrl = 'https://magumagu.example/';
const authority = 'hosted-provider-double';
export const ann: AuthenticatedUser = { authority, subject: 'user-ann', selectedOrganizationId: 'org-a' };
export const ben: AuthenticatedUser = { authority, subject: 'user-ben', selectedOrganizationId: 'org-b' };
export const userGrant: RoleGrant = { role: 'user', permissions: ['product:access'] };
export const adminGrant: RoleGrant = { role: 'admin', permissions: ['user-grants:manage'] };
const pageHeaders = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'content-security-policy': "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
};

export interface Setup {
  readonly sessions?: ReadonlyMap<string, ConfiguredSession>;
  readonly otherSession?: BrowserSessionState;
  readonly decisions?: ReadonlyMap<string, ConfiguredAccess>;
  readonly withOperation?: boolean;
}

export function serve(setup: Setup) {
  const session = new BrowserSessionDouble(setup.sessions, setup.otherSession);
  const resolver = new AccessResolverMock(setup.decisions);
  const operations = new AccountOperationDouble();
  const operation = setup.withOperation === false ? undefined : operations.operation;
  const routes = new HostedAccountRoutes({ session, accessResolver: resolver, operation });
  return { routes, session, resolver, operations };
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

export function accountRequest(path: string, cookie?: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  if (cookie !== undefined) headers.set('Cookie', cookie);
  return new Request(new URL(path, publicBaseUrl), { ...init, headers });
}

export function formPost(path: string, cookie: string, form: string): Request {
  return accountRequest(path, cookie, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://magumagu.example' },
    body: form,
  });
}

export async function assertPage(response: Response, status: number, text: RegExp): Promise<void> {
  assert.equal(response.status, status);
  assert.deepEqual(Object.fromEntries(response.headers), pageHeaders);
  const body = await response.text();
  assert.match(body, text);
  assert.doesNotMatch(body, /<form|<input|<script|<link|<img/i);
}
