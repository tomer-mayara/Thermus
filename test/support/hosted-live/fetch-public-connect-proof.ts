import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { WorkOS } from '@workos-inc/node';
import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify, type JWTPayload } from 'jose';
import { completeAuthKit } from './authkit-driver.ts';
import { LiveBrowser } from './live-browser.ts';
import { loadDeploymentConfig } from '../../../src/runtime/config/deployment-config.ts';
import { composeWorkOSApplication } from '../../../src/app/hosted-workos-application.ts';
import { startHttpServer } from '../../../src/runtime/http/server.ts';
import { fetchToolServers } from '../../../src/app/fetch-tool.ts';
import { mcpRequest, rpcResult } from '../drivers/mcp/mcp-http-request.ts';
import { OperatorLogSpy } from '../doubles/application/operator-log-spy.ts';
import { browserRedirectUri, localOrigin, mcpResource } from './settings.ts';

const applicationClientId = 'client_01M561HD70DB58BEKMSF8GCAQN';
const redirectUri = 'http://127.0.0.1:46481/callback';
const resource = mcpResource;
const scope = 'openid offline_access';

interface Tokens {
  readonly access_token: string;
  readonly refresh_token?: string;
  readonly scope?: string;
  readonly expires_in?: number;
}

function stagingSettings() {
  const apiKey = process.env.WORKOS_API_KEY ?? '';
  const clientId = process.env.WORKOS_CLIENT_ID ?? '';
  const authkitIssuer = process.env.WORKOS_AUTHKIT_ISSUER ?? '';
  assert.ok(apiKey.startsWith('sk_test_'), 'This proof requires a Staging key.');
  assert.equal(clientId, 'client_01M4VDKB7C7T2GV2NWPS84HADP', 'This proof requires the designated Staging environment.');
  assert.equal(authkitIssuer, 'https://reasonable-field-33-staging.authkit.app', 'This proof requires the designated Staging issuer.');
  return { apiKey, clientId, authkitIssuer, redirectUri: browserRedirectUri, cookiePassword: randomBytes(32).toString('base64url') };
}

async function exchange(issuer: string, fields: Readonly<Record<string, string>>): Promise<Tokens> {
  const response = await fetch(`${issuer}/oauth2/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields), signal: AbortSignal.timeout(15_000),
  });
  assert.equal(response.status, 200, `Connect exchange failed with HTTP ${response.status}.`);
  const tokens = await response.json() as Tokens;
  assert.ok(typeof tokens.access_token === 'string' && tokens.access_token !== '', 'Connect returned no access token.');
  return tokens;
}

function callbackListener(state: string) {
  const answer = Promise.withResolvers<string>();
  const listener = createServer((request, response) => {
    const url = new URL(request.url ?? '/', redirectUri);
    if (url.pathname !== '/callback') { response.writeHead(404).end(); return; }
    const valid = url.searchParams.getAll('state').length === 1 && url.searchParams.get('state') === state
      && url.searchParams.getAll('code').length === 1 && !url.searchParams.has('error');
    if (!valid) { response.writeHead(400).end('Authorization refused.'); answer.reject(new Error('The callback did not match the pending request.')); return; }
    response.writeHead(200, { 'Content-Type': 'text/plain' }).end('The Staging proof received authorization.');
    answer.resolve(url.searchParams.get('code') ?? '');
  });
  listener.requestTimeout = 10_000;
  return { listener, code: answer.promise };
}

function safeProofFailure(error: unknown): Error {
  const status = typeof error === 'object' && error !== null && 'status' in error ? String(error.status) : undefined;
  if (error instanceof assert.AssertionError) return new Error(`First-party Connect proof assertion failed: ${error.message.split('\n')[0]}`);
  return new Error(`First-party Connect proof failed (${error instanceof Error ? error.name : 'Error'}${status === undefined ? '' : ` HTTP ${status}`}).`);
}

async function cleanProof(parts: { listener: ReturnType<typeof createServer>; browser: LiveBrowser; closeBackend?: () => Promise<void>; workos: WorkOS; userId?: string; organizationId?: string }): Promise<void> {
  parts.listener.closeAllConnections();
  const closed = await Promise.allSettled([
    new Promise<void>((resolve) => parts.listener.close(() => resolve())),
    parts.browser.close(),
    parts.closeBackend?.(),
  ]);
  const failures = closed.filter((result) => result.status === 'rejected');
  if (parts.userId !== undefined) await parts.workos.userManagement.deleteUser(parts.userId).catch((reason: unknown) => { failures.push({ status: 'rejected', reason }); });
  if (parts.organizationId !== undefined) await parts.workos.organizations.deleteOrganization(parts.organizationId).catch((reason: unknown) => { failures.push({ status: 'rejected', reason }); });
  if (failures.length > 0) throw new Error(`The Staging proof could not close or delete ${failures.length} owned resources.`);
}

export async function proveFirstPartyConnect() {
  const settings = stagingSettings();
  const workos = new WorkOS({ apiKey: settings.apiKey, clientId: settings.clientId, maxRetries: 0, timeout: 15_000 });
  const browser = new LiveBrowser(async () => {
    const response = await fetch(`${settings.authkitIssuer}/.well-known/oauth-authorization-server`, { signal: AbortSignal.timeout(15_000) });
    assert.equal(response.status, 200, 'Staging discovery failed.');
    await response.body?.cancel();
  });
  const runId = `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
  let userId: string | undefined;
  let organizationId: string | undefined;
  let closeBackend: (() => Promise<void>) | undefined;
  const state = randomBytes(32).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  const callback = callbackListener(state);
  void callback.code.catch(() => undefined);
  try {
    const organization = await workos.organizations.createOrganization({ name: `Thermus fetch proof ${runId}` });
    organizationId = organization.id;
    const password = `Tf-${randomBytes(24).toString('base64url')}-9a`;
    const user = await workos.userManagement.createUser({ email: `thermus-fetch-proof-${runId}@example.net`, password, emailVerified: true, firstName: 'Thermus', lastName: 'Fetch proof' });
    userId = user.id;
    const membership = await workos.userManagement.createOrganizationMembership({ organizationId, userId, roleSlugs: ['user'] });
    callback.listener.listen(46481, '127.0.0.1');
    await once(callback.listener, 'listening');
    const authorization = new URL(`${settings.authkitIssuer}/oauth2/authorize`);
    authorization.search = new URLSearchParams({ response_type: 'code', client_id: applicationClientId, redirect_uri: redirectUri, state, resource, scope,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' }).toString();
    const page = await browser.newPage();
    await page.goto(authorization.href, { waitUntil: 'commit' });
    const pages = await completeAuthKit(page, { user: { ...user, password }, organizationName: organization.name,
      authkitHost: new URL(settings.authkitIssuer).host });
    const code = await Promise.race([callback.code, new Promise<never>((_resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('The real callback timed out.')), 10_000); timer.unref();
    })]);
    const initial = await exchange(settings.authkitIssuer, { grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: redirectUri, client_id: applicationClientId, resource });
    assert.ok(initial.refresh_token, 'Connect returned no refresh token for offline_access.');
    const keys = createRemoteJWKSet(new URL(`${settings.authkitIssuer}/oauth2/jwks`), { timeoutDuration: 15_000 });
    const verify = async (tokens: Tokens): Promise<JWTPayload> => {
      const { payload } = await jwtVerify(tokens.access_token, keys, { issuer: settings.authkitIssuer, audience: resource, algorithms: ['RS256'], requiredClaims: ['sub', 'sid', 'client_id', 'scope', 'iat', 'exp'] });
      assert.equal(payload.sub, userId, 'Connect used another user.');
      assert.equal(payload.client_id, applicationClientId, 'Connect used another client.');
      assert.equal(payload.org_id, organizationId, 'Connect used another workspace.');
      assert.equal(typeof payload.sid, 'string', 'Connect returned no consent identity.');
      assert.deepEqual(String(payload.scope).split(' ').sort(), ['offline_access', 'openid'], 'Connect returned unexpected scopes.');
      return payload;
    };
    const claims = await verify(initial);
    const log = new OperatorLogSpy();
    const config = loadDeploymentConfig({ DEPLOYMENT: 'hosted', PUBLIC_BASE_URL: `${localOrigin}/` }, 'http');
    const calls: Array<{ subject: string; organizationId?: string }> = [];
    const application = await composeWorkOSApplication(config, { settings, workos, authkitKeySet: keys }, {
      logger: log, buildServer: fetchToolServers({ fetch: async (_url, context) => {
        calls.push({ subject: context.user.subject, organizationId: context.organizationId });
        return '# First-party Public client accepted';
      }, search: async () => { throw new Error('Unexpected search call'); } }, log),
    });
    const backend = await startHttpServer(application.handle, { listen: { host: '127.0.0.1', port: 0 }, publicBaseUrl: config.publicBaseUrl, logger: log });
    closeBackend = async () => { const draining = backend.close(); await application.close(draining); await draining; };
    const call = async (token: string) => fetch(mcpRequest({ url: new URL('mcp', backend.url).href, method: 'tools/call', token, params: {
      name: 'getURLAsMarkdown', arguments: { url: 'https://example.com/', reason: 'Prove first-party Public client access' },
    } }));
    const initialResponse = await call(initial.access_token);
    const initialMcpStatus = initialResponse.status;
    assert.equal(initialMcpStatus, 200, 'The hosted MCP boundary refused the initial grant.');
    const result = await rpcResult(initialResponse);
    assert.deepEqual(result.content, [{ type: 'text', text: '# First-party Public client accepted' }]);
    const refreshed = await exchange(settings.authkitIssuer, { grant_type: 'refresh_token', refresh_token: initial.refresh_token, client_id: applicationClientId, resource });
    const after = await verify(refreshed);
    for (const name of ['sub', 'sid', 'org_id', 'client_id', 'aud', 'iss']) assert.deepEqual(after[name], claims[name], `Refresh changed ${name}.`);
    const refreshedResponse = await call(refreshed.access_token);
    const refreshedMcpStatus = refreshedResponse.status;
    await refreshedResponse.body?.cancel();
    assert.equal(refreshedMcpStatus, 200, 'The hosted MCP boundary refused the refreshed grant.');
    assert.deepEqual(calls, [{ subject: userId, organizationId }, { subject: userId, organizationId }]);
    await workos.userManagement.deactivateOrganizationMembership(membership.id);
    const denied = await call(refreshed.access_token);
    const removedMembershipMcpStatus = denied.status;
    await denied.body?.cancel();
    assert.equal(removedMembershipMcpStatus, 403, 'The backend accepted a removed membership.');
    assert.equal(calls.length, 2, 'The denied request performed protected work.');
    return { clientId: applicationClientId, issuer: settings.authkitIssuer, resource, redirectUri, firstParty: true, publicClient: true,
      callbackReachedListener: true, pages, algorithm: decodeProtectedHeader(initial.access_token).alg, scope: String(claims.scope),
      userMatches: true, workspaceMatches: true, consentIdPresent: true, lifetimeSeconds: Number(claims.exp) - Number(claims.iat),
      refreshPresent: true, refreshRotated: refreshed.refresh_token !== undefined && refreshed.refresh_token !== initial.refresh_token,
      initialMcpStatus, refreshedMcpStatus, removedMembershipMcpStatus };
  } catch (error) {
    throw safeProofFailure(error);
  } finally {
    await cleanProof({ listener: callback.listener, browser, closeBackend, workos, userId, organizationId });
  }
}
