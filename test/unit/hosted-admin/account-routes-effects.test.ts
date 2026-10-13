import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { accountRequest, allowedFor, ann, assertPage, contextOf, serve, signedIn, userGrant } from './fixtures/account-routes-fixtures.ts';

const cookies = ['session=refreshed; Path=/; Secure; HttpOnly; SameSite=Lax', 'session-hint=1; Path=/; Secure; SameSite=Lax'];
const failurePage = /The request failed\. Try again later\./;

function annAllowed() {
  return allowedFor(contextOf(ann, [userGrant], ['product:access']));
}

describe('HostedAccountRoutes failure answers after a sign-in', () => {
  test('Given an allowed decision without a tenant ID, when a signed-in user requests an account operation, then the routes refuse it before the operation with the failure page, and the operator gets a report with the path and the cause', async () => {
    const withoutTenant = { ...contextOf(ann, [userGrant], ['product:access']), tenantId: '' };
    const { routes, operations, failures } = serve({
      sessions: new Map([['session=ann', signedIn(ann)]]),
      decisions: new Map([[ann.subject, allowedFor(withoutTenant)]]),
    });

    await assertPage(await routes.handle(accountRequest('/account', 'session=ann')), { status: 500, text: failurePage });

    assert.deepEqual(failures.map(({ path }) => path), ['/account']);
    assert.match(String(failures[0]?.cause), /The access decision has no trusted tenant/);
    assert.deepEqual(operations.calls, []);
  });

  for (const failure of ['access lookup', 'operation'] as const) {
    test(`Given a failed ${failure} after a sign-in that refreshed the session, when an account request arrives, then the client gets the failure page with the refreshed session cookie, and the operator gets the path and the cause`, async () => {
      const outage = new Error(`${failure} timed out`);
      const { routes, operations, failures } = serve({
        sessions: new Map([['session=ann', signedIn(ann, { cookies })]]),
        decisions: new Map([[ann.subject, failure === 'access lookup' ? outage : annAllowed()]]),
        operationAnswer: async () => { throw outage; },
      });

      await assertPage(await routes.handle(accountRequest('/account', 'session=ann')), { status: 500, text: failurePage, cookies });

      assert.deepEqual(failures, [{ path: '/account', cause: outage }]);
      assert.equal(operations.calls.length, failure === 'operation' ? 1 : 0);
    });
  }

  test('Given operation answers that cannot carry the session cookies — an error response and a response whose body was read —, when they arrive, then the client gets the failure page with the session cookies, and the operator gets the cause', async () => {
    const readAnswer = new Response('read');
    await readAnswer.text();
    const { routes, failures } = serve({
      sessions: new Map([['session=ann', signedIn(ann, { cookies })]]),
      decisions: new Map([[ann.subject, annAllowed()]]),
      operationAnswer: async (request) => (new URL(request.url).pathname === '/error' ? Response.error() : readAnswer),
    });

    for (const path of ['/error', '/read']) {
      await assertPage(await routes.handle(accountRequest(path, 'session=ann')), { status: 500, text: failurePage, cookies });
    }

    assert.deepEqual(failures.map(({ path, cause }) => [path, (cause as Error).name]), [['/error', 'RangeError'], ['/read', 'TypeError']]);
  });

  test('Given a failed operation of a request that the client has aborted, when the operation fails, then the failure reaches the caller and the operator gets no report', async () => {
    const outage = new Error('operation stopped');
    const client = new AbortController();
    const { routes, failures } = serve({
      sessions: new Map([['session=ann', signedIn(ann)]]),
      decisions: new Map([[ann.subject, annAllowed()]]),
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
  test('Given a signed-in session with cookie effects, when the operation answers, also with a redirect whose headers cannot change, then the answer keeps its status, headers, and body, and gets the session cookies before its own cookies', async () => {
    const { routes } = serve({
      sessions: new Map([['session=ann', signedIn(ann, { cookies })]]),
      decisions: new Map([[ann.subject, annAllowed()]]),
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
    const missing = serve({ sessions: new Map([['session=ann', signedIn(ann, { cookies })]]), decisions: new Map([[ann.subject, annAllowed()]]), withOperation: false });

    await assertPage(await signedOut.routes.handle(accountRequest('/account', 'session=expired')), { status: 401, text: /Sign in to use this page\./, cookies });
    await assertPage(await denied.routes.handle(accountRequest('/account', 'session=ann')), { status: 403, text: /no access to this page/, cookies });
    await assertPage(await missing.routes.handle(accountRequest('/account', 'session=ann')), { status: 404, text: /This page does not exist\./, cookies });
  });

  test('Given a denial under a public URL path, when a signed-in user opens a tenant page, then the 403 page points to the organization page under that path', async () => {
    const { routes } = serve({
      publicBaseUrl: 'https://magumagu.example/team/',
      sessions: new Map([['session=ann', signedIn(ann)]]),
      decisions: new Map([[ann.subject, { allowed: false, reason: 'organization-required' }]]),
    });

    const body = await (await routes.handle(accountRequest('/team/portal', 'session=ann'))).text();

    assert.match(body, /<p>To select another organization, or to see how to get access, open the <a href="\/team\/organizations">organization page<\/a>\.<\/p>/);
  });
});
