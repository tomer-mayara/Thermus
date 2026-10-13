import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CLIENT_ADDRESS_HEADER } from '../../../src/http/client-address.ts';
import {
  assertPageHeaders,
  browserRequest,
  formPost,
  paths,
  providerJson,
  ProviderDouble,
  publicOrigin,
  signedQuery,
} from './fixtures/local-auth-pages-fixtures.ts';

const FORM_LIMIT = 16 * 1024;
const credentials = { email: 'alice@example.com', password: 'alice-password-1', oauth_query: signedQuery };

function signInProvider(): ProviderDouble {
  return new ProviderDouble().answer('POST /api/auth/sign-in/email', providerJson(200, { redirect: true, url: `/consent?${signedQuery}` }));
}

function rawPost(target: string, init: { readonly headers?: RequestInit['headers']; readonly body: NonNullable<RequestInit['body']> }): Request {
  return browserRequest(target, { method: 'POST', duplex: 'half', ...init } as RequestInit);
}

function countedBody(chunkSize: number) {
  const state = { pulled: 0, cancelled: false };
  const stream = new ReadableStream<Uint8Array>({
    pull: (controller) => {
      state.pulled += chunkSize;
      controller.enqueue(new Uint8Array(chunkSize).fill(0x61));
    },
    cancel: () => {
      state.cancelled = true;
    },
  }, { highWaterMark: 0 });
  return { stream, state };
}

// The password pads the form body to the given size in bytes.
function formOfSize(size: number): Record<string, string> {
  const unpadded = new URLSearchParams({ ...credentials, password: '' }).toString().length;
  return { ...credentials, password: 'p'.repeat(size - unpadded) };
}

describe('Form post content type', () => {
  const refusedTypes = {
    'no content type': undefined,
    'a JSON content type': 'application/json',
    'a text content type': 'text/plain;charset=UTF-8',
    'a multipart content type': 'multipart/form-data; boundary=form-boundary',
  };
  for (const [kind, contentType] of Object.entries(refusedTypes)) {
    test(`Given a sign-in post with ${kind}, when it comes, then the page answers 415 and calls no provider route`, async () => {
      const provider = signInProvider();
      const body = new TextEncoder().encode(new URLSearchParams(credentials).toString());

      const response = await provider.pages().handle(rawPost(paths.signIn, { headers: contentType === undefined ? {} : { 'Content-Type': contentType }, body }));
      const html = await response.text();

      assert.equal(response.status, 415);
      assert.match(html, /This page accepts only HTML form data\./);
      assertPageHeaders(response, html);
      assert.deepEqual(provider.calls, []);
    });
  }

  test('Given the form content type in capital letters and with a charset, when a sign-in post comes, then the page accepts it', async () => {
    const provider = signInProvider();

    const response = await provider.pages().handle(formPost(paths.signIn, credentials, { 'Content-Type': 'Application/X-WWW-Form-Urlencoded; charset=UTF-8' }));

    assert.equal(response.status, 303);
    assert.equal(provider.calls.length, 1);
  });
});

describe('Form post size', () => {
  test('Given a form body of exactly 16 KiB, when it is posted, then the page sends its fields to the provider', async () => {
    const provider = signInProvider();
    const fields = formOfSize(FORM_LIMIT);
    assert.equal(new URLSearchParams(fields).toString().length, FORM_LIMIT);

    const response = await provider.pages().handle(formPost(paths.signIn, fields));

    assert.equal(response.status, 303);
    assert.deepEqual(provider.calls.map(({ body }) => body), [fields]);
  });

  test('Given a form body one byte over 16 KiB, when it is posted, then the page answers 413 and calls no provider route', async () => {
    const provider = signInProvider();

    const response = await provider.pages().handle(formPost(paths.signIn, formOfSize(FORM_LIMIT + 1)));
    const html = await response.text();

    assert.equal(response.status, 413);
    assert.match(html, /The form data is too large\./);
    assertPageHeaders(response, html);
    assert.deepEqual(provider.calls, []);
  });

  test('Given a Content-Length over 16 KiB, when the form post comes, then the page answers 413 without reading the body', async () => {
    const provider = signInProvider();
    const { stream, state } = countedBody(1024);
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': String(FORM_LIMIT + 1) };

    const response = await provider.pages().handle(rawPost(paths.signIn, { headers, body: stream }));

    assert.equal(response.status, 413);
    assert.equal(state.pulled, 0);
    assert.deepEqual(provider.calls, []);
  });

  test('Given a streamed form body without Content-Length that does not end, when it passes 16 KiB, then the page answers 413, stops reading, and cancels the body', async () => {
    const provider = signInProvider();
    const { stream, state } = countedBody(1024);

    const response = await provider.pages().handle(rawPost(paths.signIn, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: stream }));

    assert.equal(response.status, 413);
    assert.ok(state.pulled <= FORM_LIMIT + 1024, `the page read ${state.pulled} bytes`);
    assert.equal(state.cancelled, true);
    assert.deepEqual(provider.calls, []);
  });
});

describe('Form post fields', () => {
  const unsignedQuery = signedQuery.replace(/&sig=[^&]*/, '');
  const invalidSignIns = {
    'no email': { password: credentials.password, oauth_query: signedQuery },
    'an empty password': { ...credentials, password: '' },
    'no oauth_query': { email: credentials.email, password: credentials.password },
    'an oauth_query without sig': { ...credentials, oauth_query: unsignedQuery },
  };
  for (const [kind, fields] of Object.entries(invalidSignIns)) {
    test(`Given a sign-in post with ${kind}, when it comes, then the page answers 400 and calls no provider route`, async () => {
      const provider = signInProvider();

      const response = await provider.pages().handle(formPost(paths.signIn, fields));
      const html = await response.text();

      assert.equal(response.status, 400);
      assert.match(html, /The sign-in request is not valid or has expired\./);
      assert.deepEqual(provider.calls, []);
    });
  }
});

describe('Provider requests', () => {
  test('Given a browser post with forwarding, authorization, and other headers, when the page calls the provider, then only the allowed browser headers and the JSON headers reach the provider', async () => {
    const provider = signInProvider();
    const allowed = {
      cookie: 'better-auth.session_token=session-1.signature',
      origin: publicOrigin,
      referer: `${publicOrigin}/sign-in?${signedQuery}`,
      'user-agent': 'Browser/1.0',
      'sec-fetch-site': 'same-origin',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-dest': 'document',
      'sec-fetch-user': '?1',
    };
    const others = {
      Authorization: 'Bearer browser-token',
      Host: 'evil.example',
      'X-Forwarded-For': '203.0.113.9',
      'X-Forwarded-Host': 'evil.example',
      Forwarded: 'for=203.0.113.9;host=evil.example',
      'Accept-Language': 'en',
      'X-Custom': 'custom',
    };

    await provider.pages().handle(formPost(paths.signIn, credentials, { ...allowed, ...others }));

    assert.deepEqual(provider.calls[0]?.headers, {
      ...allowed,
      accept: 'application/json',
      'content-type': 'application/json',
      [CLIENT_ADDRESS_HEADER]: '127.0.0.1',
    });
  });

  test('Given a browser that goes away while the page waits for the provider, when its request is aborted, then the provider request is aborted too', async () => {
    const provider = signInProvider();
    const browser = new AbortController();

    await provider.pages().handle(new Request(formPost(paths.signIn, credentials), { signal: browser.signal }));
    const forwarded = provider.calls[0]?.signal;
    const abortedBefore = forwarded?.aborted;
    browser.abort();

    assert.equal(abortedBefore, false);
    assert.equal(forwarded?.aborted, true);
  });
});
