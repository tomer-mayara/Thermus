import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertLoadsNothing, assertPageHeaders, browserRequest, formPost, hiddenOauthQuery, paths, providerJson, ProviderDouble, signedQuery } from './fixtures/local-auth-pages-fixtures.ts';

test('Given a signed consent request, when the user opens the page, then a bundled form offers allow and deny with the signed query', async () => {
  const provider = new ProviderDouble()
    .answer('GET /api/auth/get-session', providerJson(200, { user: { email: 'alice@example.com' } }))
    .answer('POST /api/auth/oauth2/public-client-prelogin', providerJson(200, { client_id: 'native-client-1', client_name: 'Native MCP client' }));
  const response = await provider.pages().handle(browserRequest(`${paths.consent}?${signedQuery}`));
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.equal(hiddenOauthQuery(html), signedQuery);
  assert.match(html, /name="accept" value="yes"/);
  assert.match(html, /name="accept" value="no"/);
  assert.doesNotMatch(html, /name="password"/);
  assert.match(html, /Native MCP client/);
  assert.match(html, /alice@example\.com/);
  assert.match(html, /openid profile email/);
  assertPageHeaders(response, html);
  assertLoadsNothing(html);
});

for (const accept of ['yes', 'no']) {
  test(`Given a consent form, when the user chooses ${accept}, then the provider gets the choice and the browser gets its redirect`, async () => {
    const provider = new ProviderDouble().answer('POST /api/auth/oauth2/consent', providerJson(200, { redirect: true, url: 'http://127.0.0.1:33418/callback?code=one' }));
    const response = await provider.pages().handle(formPost(paths.consent, { accept, oauth_query: signedQuery }));
    assert.equal(response.status, 303);
    assert.deepEqual(provider.calls[0]?.body, { accept: accept === 'yes', oauth_query: signedQuery });
  });
}

test('Given an authorization error with hostile text, when the page opens, then only an escaped bounded error code appears', async () => {
  const provider = new ProviderDouble();
  const response = await provider.pages().handle(browserRequest(`${paths.authorizationError}?error=invalid_client&error_description=secret-password`));
  const html = await response.text();
  assert.equal(response.status, 400);
  assert.match(html, /invalid_client/);
  assert.doesNotMatch(html, /secret-password|<form/);
  assertPageHeaders(response, html);
  assertLoadsNothing(html);
  assert.deepEqual(provider.calls, []);
});

test('Given an unsupported method, when a page receives it, then it returns 405 and calls no provider', async () => {
  const provider = new ProviderDouble();
  const response = await provider.pages().handle(browserRequest(paths.signIn, { method: 'DELETE' }));
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('Allow'), 'GET, POST');
  assert.deepEqual(provider.calls, []);
});

test('Given a provider failure, when the sign-in form is posted, then the page returns a safe failure without the cause', async () => {
  const pages = new (await import('../../../src/interfaces/web/auth/better-auth/local-auth-pages.ts')).LocalAuthPages(async () => { throw new Error('private database details'); }, { issuer: 'http://localhost:8080/api/auth', paths });
  const response = await pages.handle(formPost(paths.signIn, { email: 'alice@example.com', password: 'private-password', oauth_query: signedQuery }));
  assert.equal(response.status, 500);
  assert.doesNotMatch(await response.text(), /private/);
});

test('Given a browser that leaves while the form body stalls, when it cancels, then the page cancels the body and calls no provider', async () => {
  const provider = new ProviderDouble();
  const controller = new AbortController();
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({ cancel() { cancelled = true; } });
  const request = browserRequest(paths.signIn, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal: controller.signal, duplex: 'half' } as RequestInit);
  const result = provider.pages().handle(request);
  controller.abort();
  await assert.rejects(result, { name: 'AbortError' });
  assert.equal(cancelled, true);
  assert.deepEqual(provider.calls, []);
});

for (const absent of ['client', 'session']) {
  test(`Given no current ${absent}, when the consent page opens, then it shows no form and refuses the request`, async () => {
    const provider = new ProviderDouble()
      .answer('POST /api/auth/oauth2/public-client-prelogin', providerJson(absent === 'client' ? 404 : 200, { client_id: 'native-client-1', client_name: 'Native MCP client' }))
      .answer('GET /api/auth/get-session', providerJson(200, absent === 'session' ? null : { user: { email: 'alice@example.com' } }));
    const response = await provider.pages().handle(browserRequest(`${paths.consent}?${signedQuery}`));
    assert.equal(response.status, 403);
    assert.doesNotMatch(await response.text(), /<form/);
  });
}

test('Given an authorization query over 16 KiB, when the user opens a page, then the page refuses it and calls no provider', async () => {
  const provider = new ProviderDouble();
  const response = await provider.pages().handle(browserRequest(`${paths.signIn}?${signedQuery}&x=${'a'.repeat(16384)}`));
  assert.equal(response.status, 414);
  assert.deepEqual(provider.calls, []);
});

test('Given two choices in a consent form, when it is posted, then the page refuses the ambiguous input without a provider call', async () => {
  const provider = new ProviderDouble();
  const request = browserRequest(paths.consent, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `accept=yes&accept=no&oauth_query=${encodeURIComponent(signedQuery)}` });
  const response = await provider.pages().handle(request);
  assert.equal(response.status, 400);
  assert.deepEqual(provider.calls, []);
});

test('Given a consent navigation with a cookie and no origin, when the page reads signed public client data, then that lookup has no cookie and the session read keeps it', async () => {
  const provider = new ProviderDouble()
    .answer('POST /api/auth/oauth2/public-client-prelogin', providerJson(200, { client_id: 'native-client-1', client_name: 'Native MCP client' }))
    .answer('GET /api/auth/get-session', providerJson(200, { user: { email: 'alice@example.com' } }));
  const response = await provider.pages().handle(browserRequest(`${paths.consent}?${signedQuery}`, { headers: { Cookie: 'session=value' } }));
  assert.equal(response.status, 200);
  assert.equal(provider.calls[0]?.headers.cookie, undefined);
  assert.equal(provider.calls[0]?.headers.origin, undefined);
  assert.equal(provider.calls[1]?.headers.cookie, 'session=value');
});
