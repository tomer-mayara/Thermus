import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { pathToFileURL } from 'node:url';
import { fetchUrlCredentials, fetchUrlScript } from '../../support/processes/module-paths.ts';
import { fetchUrlState } from '../../support/isolation/fetch-url-state.ts';
import { callbackUrl } from './fixtures/browser-callback-harness.ts';

const { prepareOAuth } = await import(new URL('helper/oauth.ts', pathToFileURL(fetchUrlScript)).href);
const { withOAuthStore } = await import(fetchUrlCredentials);
const profile = { endpoint: 'https://gateway.example/mcp', issuer: 'https://issuer.example', clientId: 'public-test-client' };
const valid = { access_token: 'opaque-access', refresh_token: 'opaque-refresh', token_type: 'bEaReR', expires_in: 300, scope: 'openid offline_access' };

async function prepareResponse(t: TestContext, response: Record<string, unknown>) {
  const previous = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = await fetchUrlState(t);
  t.after(() => { if (previous === undefined) delete process.env.XDG_STATE_HOME; else process.env.XDG_STATE_HOME = previous; });
  let now = 1_000;
  t.mock.method(Date, 'now', () => now);
  const redirectUrl = await callbackUrl();
  return prepareOAuth({
    profile, operation: 'login', interactive: true, redirectUrl,
    openBrowser: async (url: URL) => {
      const callback = new URL(redirectUrl);
      callback.searchParams.set('state', url.searchParams.get('state') ?? '');
      callback.searchParams.set('code', 'authorization-code');
      assert.equal((await fetch(callback)).status, 200);
    },
    fetch: async (input: URL) => {
      if (String(input).includes('oauth-protected-resource')) return Response.json({ resource: profile.endpoint, authorization_servers: [profile.issuer] });
      if (String(input).includes('oauth-authorization-server')) return Response.json({
        issuer: profile.issuer, authorization_endpoint: `${profile.issuer}/authorize`, token_endpoint: `${profile.issuer}/token`,
        response_types_supported: ['code'], code_challenge_methods_supported: ['S256'],
      });
      now = 2_000;
      const json = JSON.stringify(response);
      const body = response.expires_in === Infinity ? json.replace('"expires_in":null', '"expires_in":1e309') : json;
      return new Response(body, { headers: { 'Content-Type': 'application/json' } });
    },
  }, AbortSignal.timeout(1_000));
}

test('Given an OAuth response, when it becomes ready credentials, then expiry uses request start and unused identity data is discarded', async (t) => {
  assert.equal(await prepareResponse(t, { ...valid, id_token: 'private-unused-identity' }), 'opaque-access');
  assert.deepEqual(await withOAuthStore(profile, (store: { read(): unknown }) => store.read()), {
    status: 'ready', accessToken: 'opaque-access', refreshToken: 'opaque-refresh', scope: 'openid offline_access', expiresAt: 301_000,
  });
});

test('Given no refresh token, when access is usable, then ready credentials do not invent offline support', async (t) => {
  assert.equal(await prepareResponse(t, { access_token: 'opaque-access', token_type: 'Bearer', expires_in: 300 }), 'opaque-access');
  assert.deepEqual(await withOAuthStore(profile, (store: { read(): unknown }) => store.read()), { status: 'ready', accessToken: 'opaque-access', expiresAt: 301_000 });
});

for (const response of [
  { ...valid, token_type: 'DPoP' }, { ...valid, expires_in: undefined }, { ...valid, expires_in: 1.5 },
  { ...valid, expires_in: 0 }, { ...valid, expires_in: Infinity }, { ...valid, expires_in: Number.MAX_SAFE_INTEGER },
  { ...valid, access_token: 'private-secret\nHeader: unsafe' }, { ...valid, refresh_token: '' },
  { ...valid, access_token: 'x'.repeat(65_537) },
]) {
  test(`Given invalid token response field ${JSON.stringify(Object.keys(response))}, when credentials are prepared, then only a local failure is exposed`, async (t) => {
    await assert.rejects(() => prepareResponse(t, response), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /token response|OAuth preparation failed/i);
      assert.doesNotMatch(error.message, /private-secret|opaque-/);
      return true;
    });
    assert.equal(await withOAuthStore(profile, (store: { read(): unknown }) => store.read()), null);
  });
}
