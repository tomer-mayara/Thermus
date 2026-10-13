import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { accountRequest, assertPage, publicOrigin } from './fixtures/account-routes-fixtures.ts';
import { annToken, selection, serveAnn, sessionCookies, validSelection } from './fixtures/organization-routes-fixtures.ts';

const forgedPage = /The form is not from this site or is no longer valid\./;

function formRequest(body: RequestInit['body'], signal?: AbortSignal): Request {
  return accountRequest('/organizations/select', 'session=ann', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: publicOrigin },
    body,
    duplex: 'half',
    ...(signal === undefined ? {} : { signal }),
  } as RequestInit);
}

describe('HostedAccountRoutes selection input checks', () => {
  for (const [label, origin] of [['a foreign origin', 'https://evil.example'], ['a null origin', 'null'], ['another scheme', 'http://thermus.example'], ['another port', 'https://thermus.example:8443'], ['no origin', undefined]] as const) {
    test(`Given a selection post with ${label}, when it arrives, then it gets 403 with the session cookies, its body stays unread, and no organization is checked or switched`, async () => {
      const { routes, annSession, organizations } = serveAnn();
      const request = accountRequest('/organizations/select', 'session=ann', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(origin === undefined ? {} : { Origin: origin }) },
        body: new URLSearchParams(validSelection).toString(),
      });

      await assertPage(await routes.handle(request), { status: 403, text: forgedPage, cookies: sessionCookies });

      assert.equal(request.bodyUsed, false);
      assert.deepEqual([organizations.selections, annSession.switches], [[], []]);
    });
  }

  for (const [label, fields] of [
    ['no form token', `organization_id=org-b&return_to=/administration/users`],
    ['an empty form token', `csrf_token=&organization_id=org-b&return_to=/administration/users`],
    ['the form token of another session', `csrf_token=csrf-token-of-user-ben&organization_id=org-b&return_to=/administration/users`],
    ['a longer form token', `csrf_token=${annToken}x&organization_id=org-b&return_to=/administration/users`],
    ['two form tokens', `csrf_token=${annToken}&csrf_token=${annToken}&organization_id=org-b&return_to=/administration/users`],
    ['a wrong form token and an unknown field', `csrf_token=forged&organization_id=org-b&return_to=/administration/users&role=admin`],
  ] as const) {
    test(`Given a selection post with ${label}, when it arrives, then it gets 403 with the session cookies, and no organization is checked or switched`, async () => {
      const { routes, annSession, organizations } = serveAnn();

      await assertPage(await routes.handle(selection(fields)), { status: 403, text: forgedPage, cookies: sessionCookies });

      assert.deepEqual([organizations.selections, annSession.switches], [[], []]);
    });
  }

  test('Given a session without a form token, when a selection post sends an empty token, then the post is refused', async () => {
    const { routes, annSession, organizations } = serveAnn({ csrfToken: '' });

    await assertPage(await routes.handle(selection({ ...validSelection, csrf_token: '' })), { status: 403, text: forgedPage, cookies: sessionCookies });

    assert.deepEqual([organizations.selections, annSession.switches], [[], []]);
  });

  for (const [label, fields] of [
    ['no organization', `csrf_token=${annToken}&return_to=/administration/users`],
    ['an empty organization', `csrf_token=${annToken}&organization_id=&return_to=/administration/users`],
    ['two organizations', `csrf_token=${annToken}&organization_id=org-a&organization_id=org-b&return_to=/administration/users`],
    ['an organization with a space', `csrf_token=${annToken}&organization_id=org%20b&return_to=/administration/users`],
    ['an organization with a control character', `csrf_token=${annToken}&organization_id=org-b%0a&return_to=/administration/users`],
    ['a very long organization', `csrf_token=${annToken}&organization_id=${'o'.repeat(257)}&return_to=/administration/users`],
    ['no return destination', `csrf_token=${annToken}&organization_id=org-b`],
    ['two return destinations', `csrf_token=${annToken}&organization_id=org-b&return_to=/account&return_to=/billing`],
    ['an absolute return destination', `csrf_token=${annToken}&organization_id=org-b&return_to=https://evil.example/`],
    ['a return destination for another host', `csrf_token=${annToken}&organization_id=org-b&return_to=//evil.example/`],
    ['a return destination with dot segments', `csrf_token=${annToken}&organization_id=org-b&return_to=/a/../../evil`],
    ['an organization name', `csrf_token=${annToken}&organization_id=org-b&return_to=/account&organization_name=Renamed`],
    ['an unknown field', `csrf_token=${annToken}&organization_id=org-b&return_to=/account&role=admin`],
  ] as const) {
    test(`Given a selection post with ${label}, when it arrives, then it gets 400 with the session cookies, and no organization is checked or switched`, async () => {
      const { routes, annSession, organizations } = serveAnn();

      await assertPage(await routes.handle(selection(fields)), { status: 400, text: /The request is not valid\./, cookies: sessionCookies });

      assert.deepEqual([organizations.selections, annSession.switches], [[], []]);
    });
  }

  for (const [label, contentType] of [['JSON', 'application/json'], ['multipart form data', 'multipart/form-data; boundary=x']] as const) {
    test(`Given a selection post with ${label}, when it arrives, then it gets 415, and no organization is checked or switched`, async () => {
      const { routes, annSession, organizations } = serveAnn();

      await assertPage(await routes.handle(selection(JSON.stringify(validSelection), { 'Content-Type': contentType })), { status: 415, text: /This page accepts only HTML form data\./, cookies: sessionCookies });

      assert.deepEqual([organizations.selections, annSession.switches], [[], []]);
    });
  }

  test('Given selection posts larger than 16 KiB, with and without a Content-Length, when they arrive, then each gets 413, and no organization is checked or switched', async () => {
    const { routes, annSession, organizations } = serveAnn();
    const large = `${new URLSearchParams(validSelection).toString()}&padding=${'x'.repeat(16 * 1024)}`;
    const streamed = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(large));
        controller.close();
      },
    });

    await assertPage(await routes.handle(selection(large, { 'Content-Length': String(large.length) })), { status: 413, text: /The form data is too large\./, cookies: sessionCookies });
    await assertPage(await routes.handle(formRequest(streamed)), { status: 413, text: /The form data is too large\./, cookies: sessionCookies });

    assert.deepEqual([organizations.selections, annSession.switches], [[], []]);
  });

  test('Given a selection post whose client disconnects while its body is read, when the client goes, then the reading stops and cancels the body, the failure reaches the caller, and no organization is checked, switched, or reported', { timeout: 5_000 }, async () => {
    const { routes, annSession, organizations, failures } = serveAnn();
    const client = new AbortController();
    const waiting = Promise.withResolvers<void>();
    let pulls = 0;
    let cancelled = false;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        if (pulls === 1) controller.enqueue(new TextEncoder().encode(`csrf_token=${annToken}`));
        else waiting.resolve();
      },
      cancel() {
        cancelled = true;
      },
    }, { highWaterMark: 0 });

    const answer = routes.handle(formRequest(endless, client.signal));
    await waiting.promise;
    client.abort();

    await assert.rejects(answer, { name: 'AbortError' });
    assert.equal(cancelled, true);
    assert.deepEqual([organizations.selections, annSession.switches, failures], [[], [], []]);
  });
});
