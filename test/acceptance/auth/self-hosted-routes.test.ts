import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loopbackRedirectUri } from '../../support/drivers/browser/better-auth-agents.ts';
import { dataDirectory } from '../../support/data-directory.ts';
import { LocalBrowser } from '../../support/drivers/browser/local-browser.ts';
import { selfHostedServerSettings } from '../../support/local-runtime.ts';
import { ServerProcess } from '../../support/server-process.ts';

test('Given an installation under a public URL path, when clients discover the provider and an unknown client starts authorization, then the provider metadata and bundled error page use that path and the old root routes stay closed', { timeout: 60_000 }, async (t) => {
  const publicBaseUrl = 'http://localhost:8080/team/';
  const issuer = `${publicBaseUrl}api/auth`;
  const resource = `${publicBaseUrl}mcp`;
  const server = await ServerProcess.start(t, { ...selfHostedServerSettings(dataDirectory(t)), PUBLIC_BASE_URL: publicBaseUrl });

  for (const path of ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/team/mcp']) {
    const response = await server.request(path);
    assert.equal(response.status, 200, path);
    const metadata = await response.json() as { resource: string; authorization_servers: string[] };
    assert.equal(metadata.resource, resource);
    assert.deepEqual(metadata.authorization_servers, [issuer]);
    const head = await server.request(path, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    const refusedMethod = await server.request(path, { method: 'POST' });
    assert.equal(refusedMethod.status, 405);
    assert.equal(refusedMethod.headers.get('Allow'), 'GET, HEAD');
  }
  for (const path of ['/.well-known/oauth-authorization-server/team/api/auth', '/team/api/auth/.well-known/openid-configuration']) {
    const response = await server.request(path);
    assert.equal(response.status, 200, path);
    const metadata = await response.json() as { issuer: string; authorization_endpoint: string; token_endpoint: string };
    assert.equal(metadata.issuer, issuer);
    assert.equal(metadata.authorization_endpoint, `${issuer}/oauth2/authorize`);
    assert.equal(metadata.token_endpoint, `${issuer}/oauth2/token`);
  }
  const address = await server.started();
  const browser = new LocalBrowser(() => address);
  const query = new URLSearchParams({
    client_id: 'unknown', response_type: 'code', redirect_uri: loopbackRedirectUri,
    scope: 'openid', state: 'prefix-authorization-state', resource,
    code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM', code_challenge_method: 'S256',
  });
  const authorization = await browser.navigate(`/team/api/auth/oauth2/authorize?${query}`);
  assert.equal(authorization.status, 302);
  assert.ok(authorization.location, authorization.body);
  const errorLocation = authorization.location;
  assert.equal(errorLocation.origin, new URL(publicBaseUrl).origin);
  assert.equal(errorLocation.pathname, '/team/authorization-error');
  assert.equal(errorLocation.searchParams.get('error'), 'invalid_client');
  const errorPage = await server.request(`${errorLocation.pathname}${errorLocation.search}`);
  assert.equal(errorPage.status, 400);
  assert.match(await errorPage.text(), /authorization request failed/);
  assert.equal((await server.request('/team/consent', { method: 'DELETE' })).status, 405);
  for (const path of ['/mcp', '/api/auth/oauth2/token', '/.well-known/oauth-protected-resource/mcp', '/.well-known/oauth-authorization-server/api/auth']) {
    assert.equal((await server.request(path)).status, 404, path);
  }
  assert.deepEqual(await server.stop(), { code: 0, signal: null });
  assert.equal(server.attemptedOutboundAccess, false, server.output);
});
