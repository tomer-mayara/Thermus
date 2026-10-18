import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { fetchUrlScript } from '../../support/processes/module-paths.ts';

const { discoverHostedAuthorization } = await import(new URL('fetch-url/oauth.mjs', pathToFileURL(fetchUrlScript)).href);
const profile = { endpoint: 'https://gateway.example/mcp', issuer: 'https://issuer.example', clientId: 'public-test-client' };
const authorizationMetadata = {
  issuer: profile.issuer, authorization_endpoint: `${profile.issuer}/authorize`, token_endpoint: `${profile.issuer}/token`,
  response_types_supported: ['code'], code_challenge_methods_supported: ['S256'],
};

test('Given complete metadata, when the SDK discovers it, then only the configured resource and issuer endpoints are read', async () => {
  const requests: string[] = [];
  const result = await discoverHostedAuthorization(profile, AbortSignal.timeout(1_000), async (url: URL) => {
    requests.push(String(url));
    return Response.json(requests.length === 1 ? { resource: profile.endpoint, authorization_servers: [profile.issuer] } : authorizationMetadata);
  });
  assert.equal(result.metadata.issuer, profile.issuer);
  assert.deepEqual(requests, ['https://gateway.example/.well-known/oauth-protected-resource/mcp', 'https://issuer.example/.well-known/oauth-authorization-server']);
});

test('Given unavailable discovery, when the SDK asks for metadata, then a refused response has no fallback request', async () => {
  let requests = 0;
  await assert.rejects(() => discoverHostedAuthorization(profile, AbortSignal.timeout(1_000), async () => { requests += 1; return new Response(null, { status: 404 }); }));
  assert.equal(requests, 1);
});

for (const [name, change] of [
  ['missing token endpoint', { token_endpoint: undefined }],
  ['cross-origin token endpoint', { token_endpoint: 'https://evil.example/token' }],
  ['HTTP authorization endpoint', { authorization_endpoint: 'http://issuer.example/authorize' }],
  ['missing PKCE S256', { code_challenge_methods_supported: ['plain'] }],
] as const) {
  test(`Given ${name}, when discovery finishes, then no token endpoint becomes usable`, async () => {
    let requests = 0;
    await assert.rejects(() => discoverHostedAuthorization(profile, AbortSignal.timeout(1_000), async () => {
      requests += 1;
      return Response.json(requests === 1 ? { resource: profile.endpoint, authorization_servers: [profile.issuer] } : { ...authorizationMetadata, ...change });
    }));
    assert.equal(requests, 2);
  });
}
