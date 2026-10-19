import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { pathToFileURL } from 'node:url';
import { fetchUrlCredentials, fetchUrlScript } from '../../../support/processes/module-paths.ts';
import { fetchUrlState } from '../../../support/isolation/fetch-url-state.ts';
import { callbackUrl } from './browser-callback-harness.ts';

const { prepareOAuth } = await import(new URL('helper/oauth.ts', pathToFileURL(fetchUrlScript)).href);
const { withOAuthStore } = await import(fetchUrlCredentials);
const profile = { endpoint: 'https://gateway.example/mcp', issuer: 'https://issuer.example', clientId: 'public-test-client' };

export async function prepareResponse(t: TestContext, response: Record<string, unknown>) {
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

export function savedCredentials(): Promise<unknown> {
  return withOAuthStore(profile, (store: { read(): unknown }) => store.read());
}
