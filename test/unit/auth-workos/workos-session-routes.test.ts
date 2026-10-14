import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  assertJson,
  assertPage,
  browserCookies,
  browserRequest,
  clearedSessionCookie,
  csrfToken,
  serve,
  SessionDouble,
  sessionCookie,
  signedInState,
} from './fixtures/session-routes-fixtures.ts';

describe('WorkOSSessionRoutes: the paths of the provider', () => {
  test('Given the public base URL with or without its final slash, when paths are checked, then the routes take only the sign-in, the callback, the sign-out, and the session path', () => {
    for (const base of ['https://thermus.example/team/', 'https://thermus.example/team']) {
      const { routes } = serve(new SessionDouble(), base);
      const taken = ['/team/login', '/team/callback', '/team/logout', '/team/session', '/team/', '/team/organizations', '/team/login/', '/login', '/teamlogin', '/team/Login']
        .filter((path) => routes.handles(path));

      assert.deepEqual(taken, ['/team/login', '/team/callback', '/team/logout', '/team/session'], base);
    }
  });
});

describe('WorkOSSessionRoutes: the session of the portal', () => {
  test('Given a signed-in session, when the portal reads the session path with GET or HEAD, then it gets 200 JSON with the email, the name, the organization, the MFA evidence, and the CSRF token, with the cookie effects of the session', async () => {
    for (const method of ['GET', 'HEAD']) {
      const session = new SessionDouble();
      session.state = signedInState({ cookies: [sessionCookie] });
      const { routes } = serve(session);

      const response = await routes.handle(browserRequest('/team/session', { method }));

      if (method === 'HEAD') {
        assert.deepEqual([response.status, response.headers.getSetCookie()], [200, [sessionCookie]]);
        continue;
      }
      await assertJson(response, {
        status: 200,
        body: { signedIn: true, email: 'ada@example.com', name: 'Ada Lovelace', organizationId: 'org_01ACME', mfaCompleted: true, csrfToken },
        cookies: [sessionCookie],
      });
      assert.deepEqual(session.calls, [{ method: 'authenticate', input: browserCookies }]);
    }
  });

  test('Given a session without names, with one name, and without an organization, when the portal reads it, then each absent value is left out', async () => {
    const states = [
      signedInState({ profile: { email: 'ada@example.com' }, user: { authority: 'workos:client_01TEST', subject: 'user_01ADA' }, mfaCompleted: false }),
      signedInState({ profile: { email: 'ada@example.com', lastName: 'Lovelace' } }),
      signedInState({ profile: { email: 'ada@example.com', firstName: 'Ada' } }),
    ];
    const bodies = [];

    for (const state of states) {
      const session = new SessionDouble();
      session.state = state;
      bodies.push(await (await serve(session).routes.handle(browserRequest('/team/session'))).json());
    }

    assert.deepEqual(bodies, [
      { signedIn: true, email: 'ada@example.com', mfaCompleted: false, csrfToken },
      { signedIn: true, email: 'ada@example.com', name: 'Lovelace', organizationId: 'org_01ACME', mfaCompleted: true, csrfToken },
      { signedIn: true, email: 'ada@example.com', name: 'Ada', organizationId: 'org_01ACME', mfaCompleted: true, csrfToken },
    ]);
  });

  test('Given no signed-in session, when the portal reads the session path, then it gets 401 {"signedIn":false} with the cookie effects of the session', async () => {
    const session = new SessionDouble();
    session.state = { status: 'signed-out', cookies: [clearedSessionCookie] };
    const { routes } = serve(session);

    await assertJson(await routes.handle(browserRequest('/team/session')), { status: 401, body: { signedIn: false }, cookies: [clearedSessionCookie] });
  });

  test('Given a POST to the session path, when it arrives, then it gets 405 JSON with Allow: GET, HEAD, and no session check runs', async () => {
    const { routes, session } = serve();

    const response = await routes.handle(browserRequest('/team/session', { method: 'POST' }));

    assert.equal(response.headers.get('Allow'), 'GET, HEAD');
    await assertJson(response, { status: 405, body: { error: 'method-not-allowed' } });
    assert.deepEqual(session.calls, []);
  });
});

describe('WorkOSSessionRoutes: failures', () => {
  test('Given a session check, a sign-in start, or a callback that fails, such as in a WorkOS outage, when the request arrives, then it gets a 500 page, or 500 JSON for the session path, without a cookie change, and the operator gets the path and the cause', async () => {
    const cases = [
      { path: '/team/session', configure: (session: SessionDouble, cause: Error) => { session.state = cause; } },
      { path: '/team/login', configure: (session: SessionDouble, cause: Error) => { session.start = cause; } },
      { path: '/team/callback?code=code-1&state=state-1', configure: (session: SessionDouble, cause: Error) => { session.completion = cause; } },
    ];

    for (const { path, configure } of cases) {
      const cause = new Error('WorkOS is not available');
      const session = new SessionDouble();
      configure(session, cause);
      const { routes, failures } = serve(session);

      const response = await routes.handle(browserRequest(path));

      const pathname = new URL(path, 'https://thermus.example').pathname;
      if (pathname === '/team/session') await assertJson(response, { status: 500, body: { error: 'unavailable' } });
      else await assertPage(response, { status: 500, text: /The request failed\. Try again later\./ });
      assert.deepEqual(failures, [{ path: pathname, cause }], path);
    }
  });

  test('Given a request that the client aborted, when its work fails, then the failure reaches the caller without a report', async () => {
    const cause = new Error('aborted work');
    const session = new SessionDouble();
    session.state = cause;
    const { routes, failures } = serve(session);
    const controller = new AbortController();
    controller.abort();

    await assert.rejects(routes.handle(browserRequest('/team/session', { signal: controller.signal })), (error) => error === cause);

    assert.deepEqual(failures, []);
  });

  test('Given a path that the routes do not take, when it reaches them, then it gets the 404 page without a session call', async () => {
    const { routes, session } = serve();

    await assertPage(await routes.handle(browserRequest('/team/organizations')), { status: 404, text: /This page does not exist\./ });

    assert.deepEqual(session.calls, []);
  });
});
