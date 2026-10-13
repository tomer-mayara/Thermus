import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type {
  AccessDecision,
  AccessDenialReason,
  AuthenticatedUser,
  RequestContext,
  RoleGrant,
} from '../../../src/auth/access-context.ts';
import { HostedAccountRoutes } from '../../../src/hosted-admin/account-routes.ts';
import type { BrowserSessionState } from '../../../src/hosted-admin/browser-session.ts';
import { AccessResolverMock, type ConfiguredAccess } from '../mcp/fixtures/access-resolver-mock.ts';
import { AccountOperationDouble } from './fixtures/account-operation-double.ts';
import { BrowserSessionDouble, type ConfiguredSession } from './fixtures/browser-session-double.ts';

const publicBaseUrl = 'https://magumagu.example/';
const authority = 'hosted-provider-double';
const ann: AuthenticatedUser = { authority, subject: 'user-ann', selectedOrganizationId: 'org-a' };
const ben: AuthenticatedUser = { authority, subject: 'user-ben', selectedOrganizationId: 'org-b' };
const userGrant: RoleGrant = { role: 'user', permissions: ['product:access'] };
const adminGrant: RoleGrant = { role: 'admin', permissions: ['user-grants:manage'] };
const notice = /Hosted authentication is not available yet\./;
const pageHeaders = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'content-security-policy': "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
};

interface Setup {
  readonly sessions?: ReadonlyMap<string, ConfiguredSession>;
  readonly otherSession?: BrowserSessionState;
  readonly decisions?: ReadonlyMap<string, ConfiguredAccess>;
  readonly withOperation?: boolean;
}

function serve(setup: Setup) {
  const session = new BrowserSessionDouble(setup.sessions, setup.otherSession);
  const resolver = new AccessResolverMock(setup.decisions);
  const operations = new AccountOperationDouble();
  const operation = setup.withOperation === false ? undefined : operations.operation;
  const routes = new HostedAccountRoutes({ session, accessResolver: resolver, operation });
  return { routes, session, resolver, operations };
}

function signedIn(user: AuthenticatedUser): BrowserSessionState {
  return { status: 'signed-in', user };
}

function contextOf(user: AuthenticatedUser, grants: readonly RoleGrant[], permissions: readonly string[]): RequestContext {
  return { user, tenantId: `tenant-${user.selectedOrganizationId}`, organizationId: user.selectedOrganizationId, grants, permissions };
}

function allowedFor(context: RequestContext): AccessDecision {
  return { allowed: true, context };
}

function accountRequest(path: string, cookie?: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  if (cookie !== undefined) headers.set('Cookie', cookie);
  return new Request(new URL(path, publicBaseUrl), { ...init, headers });
}

function formPost(path: string, cookie: string, form: string): Request {
  return accountRequest(path, cookie, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://magumagu.example' },
    body: form,
  });
}

async function assertPage(response: Response, status: number, text: RegExp): Promise<void> {
  assert.equal(response.status, status);
  assert.deepEqual(Object.fromEntries(response.headers), pageHeaders);
  const body = await response.text();
  assert.match(body, text);
  assert.doesNotMatch(body, /<form|<input|<script|<link|<img/i);
}

describe('HostedAccountRoutes', () => {
  test('Given a signed-in browser session with allowed access, when an account request arrives, then the operation gets that request and the decided context, and the client gets the operation answer', async () => {
    const annContext = contextOf(ann, [userGrant, adminGrant], ['product:access', 'user-grants:manage']);
    const { routes, session, resolver, operations } = serve({
      sessions: new Map([['session=ann', signedIn(ann)]]),
      decisions: new Map([[ann.subject, allowedFor(annContext)]]),
    });
    const request = formPost('/organizations/grants', 'session=ann', 'role=user');

    const response = await routes.handle(request);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('X-Operation'), 'account-operation-double');
    assert.equal(operations.calls.length, 1);
    assert.equal(operations.calls[0]?.request, request);
    assert.deepEqual(operations.calls[0]?.context, annContext);
    assert.deepEqual([session.calls, resolver.calls], [[request], [ann]]);
    assert.equal(await request.text(), 'role=user', 'the routes leave the form body to the operation');
  });

  test('Given two signed-in users of different organizations whose access resolutions finish in reverse order, when their requests overlap, then each operation gets only the context of its own request', async () => {
    const annContext = contextOf(ann, [userGrant], ['product:access']);
    const benContext = contextOf(ben, [adminGrant], ['user-grants:manage']);
    const annDecided = Promise.withResolvers<void>();
    const { routes, operations } = serve({
      sessions: new Map([['session=ann', signedIn(ann)], ['session=ben', signedIn(ben)]]),
      decisions: new Map<string, ConfiguredAccess>([
        [ann.subject, async () => {
          await annDecided.promise;
          return allowedFor(annContext);
        }],
        [ben.subject, allowedFor(benContext)],
      ]),
    });

    const annAnswer = routes.handle(accountRequest('/account', 'session=ann'));
    const benAnswer = await routes.handle(accountRequest('/account', 'session=ben'));
    annDecided.resolve();
    const answers = await Promise.all([annAnswer, benAnswer].map(async (answer) => (await answer).json()));

    assert.deepEqual(answers, [{ path: '/account', context: annContext }, { path: '/account', context: benContext }]);
    assert.deepEqual(operations.calls.map(({ context }) => context.organizationId), ['org-b', 'org-a']);
  });

  test('Given hosted authentication that is unavailable, when account, organization, and billing requests arrive with forged cookies, bearer tokens, organization IDs, and form input, then each gets the 503 notice without a cookie, and no access resolution or operation runs', async () => {
    const { routes, session, resolver, operations } = serve({
      sessions: new Map([['session=ann', signedIn(ann)]]),
      otherSession: { status: 'unavailable' },
      decisions: new Map([[ann.subject, allowedFor(contextOf(ann, [userGrant], ['product:access']))]]),
    });
    const requests = [
      accountRequest('/', 'wos-session=forged-session'),
      accountRequest('/account', undefined, { headers: { Authorization: 'Bearer forged-token' } }),
      accountRequest('/organizations?organizationId=org-a', 'wos-session=forged-session', { headers: { 'X-Organization-Id': 'org-a' } }),
      formPost('/organizations/select', 'wos-session=forged-session', 'organizationId=org-b'),
      formPost('/organizations/grants', 'wos-session=forged-session', 'organizationId=org-a&userId=user-ann&role=admin'),
      formPost('/billing/seats', 'wos-session=forged-session', 'organizationId=org-a&seatCount=5'),
    ];

    for (const request of requests) {
      const response = await routes.handle(request);
      assert.equal(response.headers.get('Set-Cookie'), null);
      await assertPage(response, 503, notice);
      assert.equal(request.bodyUsed, false);
    }

    assert.equal(session.calls.length, requests.length);
    assert.deepEqual([resolver.calls, operations.calls], [[], []]);
  });

  test('Given no signed-in browser session, when an account request arrives, then it gets 401 and no access resolution or operation runs', async () => {
    const { routes, resolver, operations } = serve({ decisions: new Map([[ann.subject, allowedFor(contextOf(ann, [userGrant], ['product:access']))]]) });

    await assertPage(await routes.handle(accountRequest('/account', 'session=unknown')), 401, /Sign in to use this page\./);

    assert.deepEqual([resolver.calls, operations.calls], [[], []]);
  });

  for (const reason of ['account-inactive', 'organization-required', 'membership-inactive', 'permission-required'] satisfies AccessDenialReason[]) {
    test(`Given the ${reason} denial, when a signed-in user requests an account operation, then it gets 403 without the reason, and no operation runs`, async () => {
      const { routes, resolver, operations } = serve({
        sessions: new Map([['session=ann', signedIn(ann)]]),
        decisions: new Map([[ann.subject, { allowed: false, reason }]]),
      });

      const response = await routes.handle(formPost('/billing/seats', 'session=ann', 'seatCount=5'));

      assert.equal(response.status, 403);
      assert.doesNotMatch(await response.clone().text(), new RegExp(reason));
      await assertPage(response, 403, /Your account has no access to this page in the selected organization\./);
      assert.deepEqual([resolver.calls, operations.calls], [[ann], []]);
    });
  }

  test('Given allowed access and no account operation, when a signed-in user requests a page, then it gets 404', async () => {
    const { routes, resolver } = serve({
      sessions: new Map([['session=ann', signedIn(ann)]]),
      decisions: new Map([[ann.subject, allowedFor(contextOf(ann, [userGrant], ['product:access']))]]),
      withOperation: false,
    });

    await assertPage(await routes.handle(accountRequest('/account', 'session=ann')), 404, /This page does not exist\./);

    assert.deepEqual(resolver.calls, [ann]);
  });

  test('Given an allowed decision without a tenant ID, when a signed-in user requests an account operation, then the routes refuse it before the operation', async () => {
    const withoutTenant = { ...contextOf(ann, [userGrant], ['product:access']), tenantId: '' };
    const { routes, operations } = serve({
      sessions: new Map([['session=ann', signedIn(ann)]]),
      decisions: new Map([[ann.subject, allowedFor(withoutTenant)]]),
    });

    await assert.rejects(routes.handle(accountRequest('/account', 'session=ann')), /The access decision has no trusted tenant/);

    assert.deepEqual(operations.calls, []);
  });

  for (const failure of ['session', 'access'] as const) {
    test(`Given a failed ${failure} lookup, when an account request arrives, then the failure reaches the caller and no operation runs`, async () => {
      const outage = new Error(`${failure} lookup timed out`);
      const { routes, operations } = serve({
        sessions: new Map([['session=ann', failure === 'session' ? outage : signedIn(ann)]]),
        decisions: new Map([[ann.subject, outage]]),
      });

      await assert.rejects(routes.handle(accountRequest('/account', 'session=ann')), outage);

      assert.deepEqual(operations.calls, []);
    });
  }
});
