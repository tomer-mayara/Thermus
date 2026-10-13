import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  assertLoadsNothing,
  assertNothingCopied,
  assertPageHeaders,
  browserRequest,
  formPost,
  hiddenOauthQuery,
  issuer,
  paths,
  providerJson,
  providerRefusal,
  ProviderDouble,
  sessionCookie,
  signedQuery,
  tagWith,
} from './fixtures/local-auth-pages-fixtures.ts';

const SIGN_IN_ROUTE = 'POST /api/auth/sign-in/email';
const credentials = { email: 'alice@example.com', password: 'alice-password-1', oauth_query: signedQuery };

async function signInWith(answer: () => Response, fields: Readonly<Record<string, string>> = credentials) {
  const provider = new ProviderDouble().answer(SIGN_IN_ROUTE, answer);
  const response = await provider.pages().handle(formPost(paths.signIn, fields));
  return { provider, response, html: await response.text() };
}

describe('Sign-in page', () => {
  test('Given a signed authorization query, when the browser opens the sign-in page, then it gets a post form with the email and password fields and the exact query in the hidden field, and no provider route is called', async () => {
    const provider = new ProviderDouble();

    const response = await provider.pages().handle(browserRequest(`${paths.signIn}?${signedQuery}`));
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(tagWith(html, 'form', 'method="post"'), /action="\/sign-in"/);
    assert.match(tagWith(html, 'input', 'name="email"'), /type="email"[^>]*autocomplete="username"/);
    assert.match(tagWith(html, 'input', 'name="password"'), /type="password"[^>]*autocomplete="current-password"/);
    assert.ok(html.includes(`<input type="hidden" name="oauth_query" value="${signedQuery.replaceAll('&', '&amp;')}">`), html);
    assert.equal(hiddenOauthQuery(html), signedQuery);
    assert.match(html, /<title>[^<]*Thermus[^<]*<\/title>/);
    assert.match(html, /<h1>[^<]*Thermus[^<]*<\/h1>/);
    assertPageHeaders(response, html);
    assertLoadsNothing(html);
    assert.deepEqual(provider.calls, []);
  });

  const unsignedQueries = {
    'without sig': signedQuery.replace(/&sig=[^&]*/, ''),
    'without client_id': signedQuery.replace(/client_id=[^&]*&/, ''),
    'with an empty sig': signedQuery.replace(/&sig=[^&]*/, '&sig='),
    'without a query': '',
  };
  for (const [kind, query] of Object.entries(unsignedQueries)) {
    test(`Given a sign-in URL ${kind}, when the browser opens it, then the page answers 400, asks the user to start from the MCP client, and calls no provider route`, async () => {
      const provider = new ProviderDouble();

      const response = await provider.pages().handle(browserRequest(`${paths.signIn}?${query}`));
      const html = await response.text();

      assert.equal(response.status, 400);
      assert.match(html, /Start the sign-in from your MCP client\./);
      assert.doesNotMatch(html, /<form/);
      assertPageHeaders(response, html);
      assert.deepEqual(provider.calls, []);
    });
  }
});

describe('Sign-in form post', () => {
  test('Given correct credentials, when the browser posts the sign-in form, then the page sends them as JSON to the provider email sign-in and sends the browser on with 303, each session cookie, and no-store', async () => {
    const consentUrl = `/consent?${signedQuery}`;
    const otherCookie = 'better-auth.dont_remember=; Max-Age=0; Path=/';
    const { provider, response, html } = await signInWith(providerJson(200, { redirect: true, url: consentUrl }, [['Set-Cookie', sessionCookie], ['Set-Cookie', otherCookie]]));

    assert.equal(response.status, 303);
    assert.equal(response.headers.get('Location'), consentUrl);
    assert.deepEqual(response.headers.getSetCookie(), [sessionCookie, otherCookie]);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(html, '');
    assert.deepEqual(provider.calls.map(({ method, url, body }) => ({ method, url, body })), [{ method: 'POST', url: `${issuer}/sign-in/email`, body: credentials }]);
    assert.equal(provider.calls[0]?.headers['content-type'], 'application/json');
    assert.equal(provider.calls[0]?.headers.accept, 'application/json');
  });

  test('Given a wrong password and hostile text in the email and query fields, when the provider answers 401, then the page shows the form again with the message, the escaped email, and the escaped query, but not the password, the provider text, or a cookie', async () => {
    const hostile = { email: '"><script>x</script>@example.com', password: 'wrong-password-1', oauth_query: `${signedQuery}&x="><b>'` };

    const { response, html } = await signInWith(providerRefusal(401, 'INVALID_EMAIL_OR_PASSWORD'), hostile);

    assert.equal(response.status, 401);
    assert.match(html, /The email address or password is not correct\./);
    assert.match(tagWith(html, 'input', 'name="email"'), /value="&quot;&gt;&lt;script&gt;x&lt;\/script&gt;@example\.com"/);
    assert.equal(hiddenOauthQuery(html), hostile.oauth_query);
    assert.doesNotMatch(html, /<script|<b>/);
    assert.ok(!html.includes(hostile.password), 'the page repeats the password');
    assert.equal(tagWith(html, 'input', 'name="password"').includes('value='), false);
    assertNothingCopied(response, html, 'INVALID_EMAIL_OR_PASSWORD');
    assertPageHeaders(response, html);
  });

  test('Given a disabled account, when the provider answers 403 BANNED_USER, then the page says that the account is disabled and shows no form', async () => {
    const { response, html } = await signInWith(providerRefusal(403, 'BANNED_USER'));

    assert.equal(response.status, 403);
    assert.match(html, /This account is disabled\. Ask the operator of this Thermus installation\./);
    assert.doesNotMatch(html, /<form/);
    assertNothingCopied(response, html, 'BANNED_USER');
  });

  for (const code of ['INVALID_ORIGIN', 'MISSING_OR_NULL_ORIGIN', 'CROSS_SITE_NAVIGATION_LOGIN_BLOCKED']) {
    test(`Given a sign-in post that the provider refuses with 403 ${code}, when the answer comes, then the page says that the sign-in request was refused and shows no provider code`, async () => {
      const { response, html } = await signInWith(providerRefusal(403, code));

      assert.equal(response.status, 403);
      assert.match(html, /The sign-in request was refused\. Start again from your MCP client\./);
      assertNothingCopied(response, html, code);
    });
  }

  test('Given too many sign-ins from one client address, when the provider answers 429 with X-Retry-After 7, then the page answers 429 with Retry-After 7 and asks the user to wait', async () => {
    const { response, html } = await signInWith(providerRefusal(429, 'TOO_MANY_REQUESTS', { 'X-Retry-After': '7' }));

    assert.equal(response.status, 429);
    assert.equal(response.headers.get('Retry-After'), '7');
    assert.match(html, /Too many sign-in attempts\. Wait and try again\./);
    assertNothingCopied(response, html, 'TOO_MANY_REQUESTS');
    assertPageHeaders(response, html);
  });

  for (const retryAfter of [undefined, '0', '-3', '2.5', '07', 'soon']) {
    test(`Given a provider 429 with X-Retry-After ${retryAfter ?? 'missing'}, when the answer comes, then the page answers 429 with Retry-After 10`, async () => {
      const { response } = await signInWith(providerRefusal(429, 'TOO_MANY_REQUESTS', retryAfter === undefined ? {} : { 'X-Retry-After': retryAfter }));

      assert.equal(response.status, 429);
      assert.equal(response.headers.get('Retry-After'), '10');
    });
  }

  test('Given a changed oauth_query, when the provider answers 400 invalid_signature, then the page says that the sign-in request is not valid or has expired', async () => {
    const { response, html } = await signInWith(providerJson(400, { error: 'invalid_signature' }, { 'Set-Cookie': 'better-auth.session_token=refused; Path=/' }));

    assert.equal(response.status, 400);
    assert.match(html, /The sign-in request is not valid or has expired\. Start again from your MCP client\./);
    assertNothingCopied(response, html, 'invalid_signature');
  });

  const unexpectedAnswers = {
    'a 500': providerRefusal(500, 'INTERNAL_SERVER_ERROR'),
    'a 404': providerRefusal(404, 'NOT_FOUND'),
    'a 200 without a redirect': providerJson(200, { redirect: false, token: 'session-1' }, { 'Set-Cookie': sessionCookie }),
    'a 200 with a URL that is not text': providerJson(200, { redirect: true, url: 42 }),
    'a 200 that is not JSON': () => new Response('Provider message text', { status: 200 }),
    'a 302': () => new Response(null, { status: 302, headers: { Location: '/elsewhere' } }),
  };
  for (const [kind, answer] of Object.entries(unexpectedAnswers)) {
    test(`Given ${kind} from the provider, when the sign-in completes, then the page answers 500 and asks the user to try again later`, async () => {
      const { response, html } = await signInWith(answer);

      assert.equal(response.status, 500);
      assert.match(html, /The sign-in failed\. Try again later\./);
      assertNothingCopied(response, html, 'INTERNAL_SERVER_ERROR');
    });
  }
});
