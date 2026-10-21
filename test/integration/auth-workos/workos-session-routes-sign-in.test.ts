import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { WorkOSSessionRoutes } from '../../../src/interfaces/web/auth/workos/workos-session-routes.ts';
import {
  assertPage,
  assertRedirect,
  authKitUrl,
  browserCookies,
  browserRequest,
  clearedSignInCookie,
  serve,
  SessionDouble,
  sessionCookie,
  signInCookie,
} from './fixtures/session-routes-fixtures.ts';

describe('WorkOSSessionRoutes: the sign-in', () => {
  test('Given a browser without a return path, when it opens the sign-in path with GET or HEAD, then the server starts a sign-in that returns to the public base path and sends the browser to AuthKit with the sign-in cookie', async () => {
    for (const method of ['GET', 'HEAD']) {
      const { routes, session } = serve();

      const response = await routes.handle(browserRequest('/team/login', { method }));

      assertRedirect(response, authKitUrl, [signInCookie]);
      assert.deepEqual(session.calls, [{ method: 'startSignIn', input: { returnTo: '/team/' } }], method);
    }
  });

  test('Given a return path under the public path of at most 1,024 path characters, when the sign-in starts, then the sign-in keeps it; other query values, which AuthKit can add, change nothing', async () => {
    const accepted = ['/team/', '/team/members', `/team/${'a'.repeat(1_018)}`, "/team/a-b_c.d~e!$&'()*+,;=:@%20/"];

    for (const returnTo of accepted) {
      const { routes, session } = serve();

      const response = await routes.handle(browserRequest(`/team/login?context=authkit&return_to=${encodeURIComponent(returnTo)}`));

      assert.equal(response.status, 303, returnTo);
      assert.deepEqual(session.calls, [{ method: 'startSignIn', input: { returnTo } }], returnTo);
    }
  });

  test('Given a return path that is not a page of this service, when the sign-in path opens, then it gets the 400 page, and no sign-in starts', async () => {
    const refused = [
      '', 'team/members', '/other/page', '/teamevil/page', '/team', '//evil.example/team/', 'https://evil.example/team/', '/team/../other',
      '/team/./members', '/team/%2e%2e/other', '/team/.%2E/other', '/team/members?next=1', '/team/members#top', '/team\\members',
      '/team/mem bers', '/team/é', '/team/login', '/team/callback', `/team/${'a'.repeat(1_019)}`,
    ];

    for (const returnTo of refused) {
      const { routes, session } = serve();

      const response = await routes.handle(browserRequest(`/team/login?return_to=${encodeURIComponent(returnTo)}`));

      await assertPage(response, { status: 400, text: /The sign-in request is not valid\./ });
      assert.deepEqual(session.calls, [], returnTo);
    }
  });

  test('Given two return paths, when the sign-in path opens, then it gets the 400 page, and no sign-in starts', async () => {
    const { routes, session } = serve();

    await assertPage(await routes.handle(browserRequest('/team/login?return_to=/team/a&return_to=/team/b')), { status: 400, text: /not valid/ });

    assert.deepEqual(session.calls, []);
  });

  test('Given a POST to the sign-in path, when it arrives, then it gets 405 with Allow: GET, HEAD, and no sign-in starts', async () => {
    const { routes, session } = serve();

    await assertPage(await routes.handle(browserRequest('/team/login', { method: 'POST' })), { status: 405, text: /does not accept this request method/, allow: 'GET, HEAD' });

    assert.deepEqual(session.calls, []);
  });
});

describe('WorkOSSessionRoutes: the sign-in callback', () => {
  test('Given a callback that completes the sign-in, when it arrives, then the session gets the query and the Cookie header, and the browser goes to the return path on the public origin with the cleared sign-in cookie and the session cookie', async () => {
    for (const method of ['GET', 'HEAD']) {
      const { routes, session } = serve();

      const response = await routes.handle(browserRequest('/team/callback?code=code-1&state=state-1', { method }));

      assertRedirect(response, 'https://thermus.example/team/members', [clearedSignInCookie, sessionCookie]);
      assert.deepEqual(session.calls, [{ method: 'completeSignIn', input: { query: 'code=code-1&state=state-1', cookieHeader: browserCookies } }], method);
    }
  });

  test('Given a refused callback, when it arrives, then it gets the 400 page "Sign-in did not complete" with a link to the sign-in path and the cleared sign-in cookie', async () => {
    const session = new SessionDouble();
    session.completion = { status: 'refused', reason: 'state-mismatch', cookies: [clearedSignInCookie] };
    const { routes } = serve(session);

    const body = await assertPage(await routes.handle(browserRequest('/team/callback?code=code-1&state=other')), {
      status: 400,
      text: /<h1>Sign-in did not complete<\/h1>/,
      cookies: [clearedSignInCookie],
    });

    assert.match(body, /<a href="\/team\/login">Sign in again<\/a>/);
    assert.doesNotMatch(body, /state-mismatch|code-1/);
  });

  test('Given a public path with HTML characters, when a callback is refused, then the link to the sign-in path is escaped', async () => {
    const session = new SessionDouble();
    session.completion = { status: 'refused', reason: 'provider-error', cookies: [clearedSignInCookie] };
    const routes = new WorkOSSessionRoutes({
      session,
      publicBaseUrl: "https://thermus.example/a&b'c/",
      redirectUri: "https://thermus.example/a&b'c/callback",
      reportFailure: () => assert.fail('a refused callback is no failure'),
    });

    const body = await assertPage(await routes.handle(new Request("https://thermus.example/a&b'c/callback?error=access_denied")), {
      status: 400,
      text: /Sign-in did not complete/,
      cookies: [clearedSignInCookie],
    });

    assert.match(body, /<a href="\/a&amp;b&#39;c\/login">Sign in again<\/a>/);
  });

  test('Given a return path in the sealed sign-in that is not a page of this service, when the callback completes, then the browser goes to the public base path instead', async () => {
    const session = new SessionDouble();
    session.completion = { status: 'signed-in', returnTo: '//evil.example/team/', cookies: [clearedSignInCookie, sessionCookie] };
    const { routes } = serve(session);

    assertRedirect(await routes.handle(browserRequest('/team/callback?code=code-1&state=state-1')), 'https://thermus.example/team/', [clearedSignInCookie, sessionCookie]);
  });

  test('Given a POST to the callback, when it arrives, then it gets 405 with Allow: GET, HEAD, and no sign-in completes', async () => {
    const { routes, session } = serve();

    await assertPage(await routes.handle(browserRequest('/team/callback?code=code-1&state=state-1', { method: 'POST' })), {
      status: 405,
      text: /does not accept this request method/,
      allow: 'GET, HEAD',
    });

    assert.deepEqual(session.calls, []);
  });
});
