import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { pathToFileURL } from 'node:url';
import { fetchUrlCredentials, fetchUrlScript } from '../../support/processes/module-paths.ts';
import { fetchUrlState } from '../../support/isolation/fetch-url-state.ts';

const { prepareOAuth } = await import(new URL('helper/oauth.ts', pathToFileURL(fetchUrlScript)).href);
const { withOAuthStore } = await import(fetchUrlCredentials);
const profile = { endpoint: 'https://gateway.example/mcp', issuer: 'https://issuer.example', clientId: 'public-test-client' };
const authorizationMetadata = {
  issuer: profile.issuer, authorization_endpoint: `${profile.issuer}/authorize`, token_endpoint: `${profile.issuer}/token`,
  response_types_supported: ['code'], code_challenge_methods_supported: ['S256'],
};

async function discoverForRefresh(t: TestContext, fetchImpl: typeof fetch) {
  const previous = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = await fetchUrlState(t);
  t.after(() => { if (previous === undefined) delete process.env.XDG_STATE_HOME; else process.env.XDG_STATE_HOME = previous; });
  await withOAuthStore(profile, (store: { saveReady(value: unknown): void }) => store.saveReady({ accessToken: 'expired-access', refreshToken: 'saved-refresh', expiresAt: 1 }));
  return prepareOAuth({ profile, operation: 'fetch', interactive: false, fetch: fetchImpl }, AbortSignal.timeout(1_000));
}

test('Given complete metadata, when the SDK discovers it, then only the configured resource and issuer endpoints are read', async (t) => {
  const requests: string[] = [];
  const result = await discoverForRefresh(t, async (url, init) => {
    if (init?.method === 'POST') {
      assert.equal(String(url), authorizationMetadata.token_endpoint);
      return Response.json({ access_token: 'fresh-access', token_type: 'Bearer', expires_in: 300 });
    }
    requests.push(String(url));
    return Response.json(requests.length === 1 ? { resource: profile.endpoint, authorization_servers: [profile.issuer] } : authorizationMetadata);
  });
  assert.equal(result, 'fresh-access');
  assert.deepEqual(requests, ['https://gateway.example/.well-known/oauth-protected-resource/mcp', 'https://issuer.example/.well-known/oauth-authorization-server']);
});

test('Given unavailable discovery, when the SDK asks for metadata, then a refused response has no fallback request', async (t) => {
  let requests = 0;
  await assert.rejects(() => discoverForRefresh(t, async () => { requests += 1; return new Response(null, { status: 404 }); }));
  assert.equal(requests, 1);
});

for (const [name, change] of [
  ['missing token endpoint', { token_endpoint: undefined }],
  ['cross-origin token endpoint', { token_endpoint: 'https://evil.example/token' }],
  ['HTTP authorization endpoint', { authorization_endpoint: 'http://issuer.example/authorize' }],
  ['missing PKCE S256', { code_challenge_methods_supported: ['plain'] }],
] as const) {
  test(`Given ${name}, when discovery finishes, then no token endpoint becomes usable`, async (t) => {
    let requests = 0;
    await assert.rejects(() => discoverForRefresh(t, async () => {
      requests += 1;
      return Response.json(requests === 1 ? { resource: profile.endpoint, authorization_servers: [profile.issuer] } : { ...authorizationMetadata, ...change });
    }));
    assert.equal(requests, 2);
  });
}
