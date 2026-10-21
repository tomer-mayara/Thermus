import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  assertPage,
  assertRedirect,
  browserCookies,
  browserRequest,
  clearedSessionCookie,
  csrfToken,
  logoutPost,
  logoutUrl,
  serve,
  SessionDouble,
} from './fixtures/session-routes-fixtures.ts';

const FORM_LIMIT = 16 * 1024;

// An endless body. It counts each chunk that a reader takes and notes when the reader cancels it. Without a queue, the
// stream makes a chunk only for a read.
function streamedBody(chunkBytes: number) {
  const record = { chunks: 0, cancelled: false };
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      record.chunks += 1;
      controller.enqueue(new TextEncoder().encode('a'.repeat(chunkBytes)));
    },
    cancel() {
      record.cancelled = true;
    },
  }, { highWaterMark: 0 });
  return { stream, record };
}

describe('WorkOSSessionRoutes: the sign-out', () => {
  test('Given a signed-in browser, when it posts the sign-out form with the CSRF token of its session from the public origin, then the session ends, and the browser goes to the WorkOS logout URL with the cleared session cookie', async () => {
    const { routes, session } = serve();

    const response = await routes.handle(logoutPost(`csrf_token=${csrfToken}`));

    assertRedirect(response, logoutUrl, [clearedSessionCookie]);
    assert.deepEqual(session.calls, [{ method: 'csrfTokenOf', input: browserCookies }, { method: 'endSession', input: browserCookies }]);
  });

  test('Given a browser without a usable session, when it posts the sign-out form, then the browser goes to the public base URL with the cleared session cookie', async () => {
    const session = new SessionDouble();
    session.token = undefined;
    session.end = { cookies: [clearedSessionCookie] };
    const { routes } = serve(session);

    assertRedirect(await routes.handle(logoutPost('csrf_token=any-token')), 'https://thermus.example/team/', [clearedSessionCookie]);
    assert.deepEqual(session.methods(), ['csrfTokenOf', 'endSession']);
  });

  test('Given a session cookie whose seal names no WorkOS session, when the sign-out form posts its token, then the browser goes to the public base URL with the cleared session cookie', async () => {
    const session = new SessionDouble();
    session.end = { cookies: [clearedSessionCookie] };
    const { routes } = serve(session);

    assertRedirect(await routes.handle(logoutPost(`csrf_token=${csrfToken}`)), 'https://thermus.example/team/', [clearedSessionCookie]);
  });

  test('Given a token that differs from the token of the session, when the sign-out form posts it, then it gets 403, and the session does not end', async () => {
    for (const token of [`${csrfToken.slice(0, -1)}X`, `${csrfToken}-and-more`, '']) {
      const { routes, session } = serve();

      await assertPage(await routes.handle(logoutPost(`csrf_token=${encodeURIComponent(token)}`)), { status: 403, text: /The form is not from this site or is no longer valid\./ });
      assert.deepEqual(session.methods(), ['csrfTokenOf'], token);
    }
  });

  test('Given another method than POST, when it reaches the sign-out path, then it gets 405 with Allow: POST, and no session call runs', async () => {
    for (const method of ['GET', 'HEAD', 'PUT']) {
      const { routes, session } = serve();

      await assertPage(await routes.handle(browserRequest('/team/logout', { method })), { status: 405, text: /does not accept this request method/, allow: 'POST' });
      assert.deepEqual(session.calls, [], method);
    }
  });

  test('Given a post from another origin, without an Origin header, or with the origin null, when it reaches the sign-out path, then it gets 403 before the body is read, and no session call runs', async () => {
    const origins: ReadonlyArray<Readonly<Record<string, string>>> = [{ Origin: 'https://evil.example' }, { Origin: 'null' }, { Origin: 'http://thermus.example' }];
    const requests = [
      ...origins.map((origin) => logoutPost(`csrf_token=${csrfToken}`, origin)),
      browserRequest('/team/logout', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `csrf_token=${csrfToken}` }),
    ];

    for (const request of requests) {
      const { routes, session } = serve();

      await assertPage(await routes.handle(request), { status: 403, text: /The form is not from this site/ });
      assert.equal(request.bodyUsed, false);
      assert.deepEqual(session.calls, []);
    }
  });

  test('Given a body that is not HTML form data, when it posts to the sign-out path, then it gets 415, and no session call runs', async () => {
    for (const contentType of ['application/json', 'multipart/form-data; boundary=x', 'text/plain']) {
      const { routes, session } = serve();

      await assertPage(await routes.handle(logoutPost(`csrf_token=${csrfToken}`, { 'Content-Type': contentType })), { status: 415, text: /accepts only HTML form data/ });
      assert.deepEqual(session.calls, [], contentType);
    }
  });

  test('Given a form type with parameters and another case, when it posts the sign-out form, then the form is accepted', async () => {
    const { routes } = serve();

    const response = await routes.handle(logoutPost(`csrf_token=${csrfToken}`, { 'Content-Type': 'Application/X-WWW-Form-Urlencoded; charset=UTF-8' }));

    assert.equal(response.status, 303);
  });

  test('Given a body larger than 16 KiB with its Content-Length, when it posts to the sign-out path, then it gets 413, and the body is cancelled without a read', async () => {
    const { routes, session } = serve();
    const { stream, record } = streamedBody(1_024);

    await assertPage(await routes.handle(logoutPost(stream, { 'Content-Length': String(FORM_LIMIT + 1) })), { status: 413, text: /The form data is too large\./ });

    assert.deepEqual(record, { chunks: 0, cancelled: true });
    assert.deepEqual(session.calls, []);
  });

  test('Given a streamed body without Content-Length, when it grows over 16 KiB, then the reading stops at the limit and the post gets 413; a body of exactly 16 KiB is read', async () => {
    const { routes, session } = serve();
    const { stream, record } = streamedBody(1_024);
    const streamed = logoutPost(stream);
    const exact = logoutPost(`csrf_token=${'a'.repeat(FORM_LIMIT - 'csrf_token='.length)}`);

    await assertPage(await routes.handle(streamed), { status: 413, text: /The form data is too large\./ });
    const exactAnswer = await routes.handle(exact);

    assert.equal(record.cancelled, true);
    assert.ok(record.chunks <= 18, `the reader took ${record.chunks} chunks`);
    assert.equal(exactAnswer.status, 403, 'a form of exactly 16 KiB is read and its token is checked');
    assert.deepEqual(session.methods(), ['csrfTokenOf']);
  });

  test('Given a client that aborts while the sign-out body is read, when the abort comes, then the reading stops, the body is cancelled, and the failure reaches the caller without a report or a session call', async () => {
    const { routes, session, failures } = serve();
    const record = { chunks: 0, cancelled: false };
    const firstChunkRead = Promise.withResolvers<void>();
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        record.chunks += 1;
        if (record.chunks > 1) return new Promise(() => firstChunkRead.resolve());
        controller.enqueue(new TextEncoder().encode('csrf_token='));
        return undefined;
      },
      cancel() {
        record.cancelled = true;
      },
    }, { highWaterMark: 0 });
    const client = new AbortController();
    const request = new Request('https://thermus.example/team/logout', {
      method: 'POST',
      headers: { Origin: 'https://thermus.example', 'Content-Type': 'application/x-www-form-urlencoded', Cookie: browserCookies },
      body,
      duplex: 'half',
      signal: client.signal,
    });

    const answer = routes.handle(request);
    await firstChunkRead.promise;
    client.abort(new Error('the client went away'));

    await assert.rejects(answer, { message: 'the client went away' });
    assert.equal(record.cancelled, true);
    assert.deepEqual([failures, session.calls], [[], []]);
  });

  test('Given a form without the CSRF token, with two tokens, or with another field, when it posts to the sign-out path, then it gets 400, and no session call runs', async () => {
    for (const form of ['', 'token=1', `csrf_token=${csrfToken}&csrf_token=${csrfToken}`, `csrf_token=${csrfToken}&return_to=/team/`]) {
      const { routes, session } = serve();

      await assertPage(await routes.handle(logoutPost(form)), { status: 400, text: /The request is not valid\./ });
      assert.deepEqual(session.calls, [], form);
    }
  });

  test('Given an end of the session that fails, when the sign-out form posts, then it gets the 500 page without a cookie change, and the operator gets the path and the cause', async () => {
    const cause = new Error('the seal could not be read');
    const session = new SessionDouble();
    session.end = cause;
    const { routes, failures } = serve(session);

    await assertPage(await routes.handle(logoutPost(`csrf_token=${csrfToken}`)), { status: 500, text: /The request failed\. Try again later\./ });

    assert.deepEqual(failures, [{ path: '/team/logout', cause }]);
  });
});
