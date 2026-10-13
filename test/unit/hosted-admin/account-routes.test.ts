import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { AccessDenialReason } from '../../../src/auth/access-context.ts';
import { unavailableNotice as notice } from '../../support/hosted-placeholder.ts';
import type { ConfiguredAccess } from '../mcp/fixtures/access-resolver-mock.ts';
import {
  accountRequest,
  adminGrant,
  allowedFor,
  ann,
  assertPage,
  ben,
  contextOf,
  formPost,
  serve,
  signedIn,
  userGrant,
} from './fixtures/account-routes-fixtures.ts';

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
    assert.deepEqual([session.calls, resolver.calls], [['session=ann'], [ann]]);
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

  test('Given a resolver that changes its records after its decision, when the operation runs, then it gets a frozen copy of the decided context that later changes cannot reach', async () => {
    const decided = contextOf(ann, [userGrant], ['product:access']);
    const records = { ...decided, user: { ...ann }, grants: [{ ...userGrant, permissions: [...userGrant.permissions] }], permissions: [...decided.permissions] };
    const { routes, operations } = serve({
      sessions: new Map([['session=ann', signedIn(ann)]]),
      decisions: new Map([[ann.subject, allowedFor(records)]]),
    });

    await routes.handle(accountRequest('/account', 'session=ann'));
    records.grants.push({ ...adminGrant, permissions: [...adminGrant.permissions] });
    records.grants[0]?.permissions.push('billing:manage');
    records.permissions.push('user-grants:manage', 'billing:manage');
    Object.assign(records, { tenantId: 'tenant-org-b', organizationId: 'org-b' });
    Object.assign(records.user, { subject: 'user-ben', selectedOrganizationId: 'org-b' });

    const context = operations.calls[0]?.context;
    assert.deepEqual(context, decided);
    assert.deepEqual([context, context?.user, context?.grants, context?.grants[0], context?.grants[0]?.permissions, context?.permissions].map(Object.isFrozen), [true, true, true, true, true, true]);
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
      await assertPage(response, { status: 503, text: notice });
      assert.equal(request.bodyUsed, false);
    }

    assert.deepEqual(session.calls, ['wos-session=forged-session', null, ...Array(4).fill('wos-session=forged-session')]);
    assert.deepEqual([resolver.calls, operations.calls], [[], []]);
  });

  test('Given no signed-in browser session, when an account request arrives, then it gets 401 and no access resolution or operation runs', async () => {
    const { routes, resolver, operations } = serve({ decisions: new Map([[ann.subject, allowedFor(contextOf(ann, [userGrant], ['product:access']))]]) });

    await assertPage(await routes.handle(accountRequest('/account', 'session=unknown')), { status: 401, text: /Sign in to use this page\./ });

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
      await assertPage(response, { status: 403, text: /Your account has no access to this page in the selected organization\./ });
      assert.deepEqual([resolver.calls, operations.calls], [[ann], []]);
    });
  }

  test('Given allowed access and no account operation, when a signed-in user requests a page, then it gets 404', async () => {
    const { routes, resolver } = serve({
      sessions: new Map([['session=ann', signedIn(ann)]]),
      decisions: new Map([[ann.subject, allowedFor(contextOf(ann, [userGrant], ['product:access']))]]),
      withOperation: false,
    });

    await assertPage(await routes.handle(accountRequest('/account', 'session=ann')), { status: 404, text: /This page does not exist\./ });

    assert.deepEqual(resolver.calls, [ann]);
  });

  test('Given an allowed decision without a tenant ID, when a signed-in user requests an account operation, then the routes refuse it before the operation with the failure page, and the operator gets a report with the path and the cause', async () => {
    const withoutTenant = { ...contextOf(ann, [userGrant], ['product:access']), tenantId: '' };
    const { routes, operations, failures } = serve({
      sessions: new Map([['session=ann', signedIn(ann)]]),
      decisions: new Map([[ann.subject, allowedFor(withoutTenant)]]),
    });

    await assertPage(await routes.handle(accountRequest('/account', 'session=ann')), { status: 500, text: /The request failed\. Try again later\./ });

    assert.deepEqual(failures.map(({ path }) => path), ['/account']);
    assert.match(String(failures[0]?.cause), /The access decision has no trusted tenant/);
    assert.deepEqual(operations.calls, []);
  });

  test('Given a failed session lookup, when an account request arrives, then the failure reaches the caller, and no access resolution, operation, or report follows', async () => {
    const outage = new Error('session lookup timed out');
    const { routes, resolver, operations, failures } = serve({
      sessions: new Map([['session=ann', outage]]),
      decisions: new Map([[ann.subject, allowedFor(contextOf(ann, [userGrant], ['product:access']))]]),
    });

    await assert.rejects(routes.handle(accountRequest('/account', 'session=ann')), outage);

    assert.deepEqual([resolver.calls, operations.calls, failures], [[], [], []]);
  });

  for (const failure of ['access lookup', 'operation'] as const) {
    test(`Given a failed ${failure} after a sign-in that refreshed the session, when an account request arrives, then the client gets the failure page with the refreshed session cookie, and the operator gets the path and the cause`, async () => {
      const outage = new Error(`${failure} timed out`);
      const cookies = ['session=refreshed; Path=/; Secure; HttpOnly; SameSite=Lax'];
      const { routes, operations, failures } = serve({
        sessions: new Map([['session=ann', signedIn(ann, { cookies })]]),
        decisions: new Map([[ann.subject, failure === 'access lookup' ? outage : allowedFor(contextOf(ann, [userGrant], ['product:access']))]]),
        operationAnswer: async () => { throw outage; },
      });

      await assertPage(await routes.handle(accountRequest('/account', 'session=ann')), { status: 500, text: /The request failed\. Try again later\./, cookies: cookies });

      assert.deepEqual(failures, [{ path: '/account', cause: outage }]);
      assert.equal(operations.calls.length, failure === 'operation' ? 1 : 0);
    });
  }

  test('Given a failed operation of a request that the client has aborted, when the operation fails, then the failure reaches the caller and the operator gets no report', async () => {
    const outage = new Error('operation stopped');
    const client = new AbortController();
    const { routes, failures } = serve({
      sessions: new Map([['session=ann', signedIn(ann)]]),
      decisions: new Map([[ann.subject, allowedFor(contextOf(ann, [userGrant], ['product:access']))]]),
      operationAnswer: async () => {
        client.abort();
        throw outage;
      },
    });

    await assert.rejects(routes.handle(accountRequest('/account', 'session=ann', { signal: client.signal })), outage);

    assert.deepEqual(failures, []);
  });
});

describe('HostedAccountRoutes cookie effects', () => {
  const cookies = ['session=refreshed; Path=/; Secure; HttpOnly; SameSite=Lax', 'session-hint=1; Path=/; Secure; SameSite=Lax'];

  test('Given a signed-in session with cookie effects, when the operation answers, also with a redirect whose headers cannot change, then the answer keeps its status, headers, and body, and gets the session cookies before its own cookies', async () => {
    const { routes } = serve({
      sessions: new Map([['session=ann', signedIn(ann, { cookies })]]),
      decisions: new Map([[ann.subject, allowedFor(contextOf(ann, [userGrant], ['product:access']))]]),
      operationAnswer: async (request) => (new URL(request.url).pathname === '/moved'
        ? Response.redirect('https://magumagu.example/account', 303)
        : new Response('done', { status: 201, statusText: 'Created here', headers: { 'Set-Cookie': 'preference=compact; Path=/', 'X-Operation': 'kept' } })),
    });

    const done = await routes.handle(accountRequest('/account', 'session=ann'));
    const moved = await routes.handle(accountRequest('/moved', 'session=ann'));

    assert.deepEqual([done.status, done.statusText, done.headers.get('X-Operation')], [201, 'Created here', 'kept']);
    assert.deepEqual(done.headers.getSetCookie(), [...cookies, 'preference=compact; Path=/']);
    assert.equal(await done.text(), 'done');
    assert.deepEqual([moved.status, moved.headers.get('Location')], [303, 'https://magumagu.example/account']);
    assert.deepEqual(moved.headers.getSetCookie(), cookies);
  });

  test('Given session cookie effects, when the session is signed out, access is denied, or no operation exists, then each refusal page carries them in their order', async () => {
    const signedOut = serve({ otherSession: { status: 'signed-out', cookies } });
    const denied = serve({ sessions: new Map([['session=ann', signedIn(ann, { cookies })]]), decisions: new Map([[ann.subject, { allowed: false, reason: 'membership-inactive' }]]) });
    const missing = serve({
      sessions: new Map([['session=ann', signedIn(ann, { cookies })]]),
      decisions: new Map([[ann.subject, allowedFor(contextOf(ann, [userGrant], ['product:access']))]]),
      withOperation: false,
    });

    await assertPage(await signedOut.routes.handle(accountRequest('/account', 'session=expired')), { status: 401, text: /Sign in to use this page\./, cookies: cookies });
    await assertPage(await denied.routes.handle(accountRequest('/account', 'session=ann')), { status: 403, text: /no access to this page/, cookies: cookies });
    await assertPage(await missing.routes.handle(accountRequest('/account', 'session=ann')), { status: 404, text: /This page does not exist\./, cookies: cookies });
  });
});
