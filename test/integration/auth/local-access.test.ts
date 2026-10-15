import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { inspect } from 'node:util';
import { describe, test, type TestContext } from 'node:test';
import { BetterAuthProvider, LOCAL_USER_GRANT } from '../../../src/auth/local-auth/better-auth/better-auth-provider.ts';
import {
  openBetterAuthRuntime,
  type BetterAuthRuntime,
  type ResourceServerClient,
} from '../../../src/auth/local-auth/better-auth/better-auth-runtime.ts';
import { MCPServer } from '../../../src/mcp/mcp-server.ts';
import {
  errorCodeOf,
  followAuthorizationWithConsent,
  HttpAgent,
  jwtClaims,
  loopbackRedirectUri,
  PreRegisteredNativeClient,
  type TokenResponse,
} from '../../support/drivers/browser/better-auth-agents.ts';
import { authIssuer, mcpResourceUrl, withRegistrationSession, type AccountCredentials, type LocalAuth } from '../../support/in-process/better-auth-local.ts';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { guardOutboundFetch } from '../../support/isolation/outbound-fetch-guard.ts';
import { FailureReporterSpy } from '../../support/doubles/mcp/failure-reporter-spy.ts';
import { mcpRequest, toolJson } from '../../support/drivers/mcp/mcp-http-request.ts';
import { resourceServerClient, userGrant, type UserGrant } from '../../support/dsl/local-commands.ts';
import { addAccount, passwordOf, selfHostedConfig } from '../../support/in-process/local-runtime.ts';
import { ProtectedToolSpy, type ProbeReport } from '../../support/doubles/mcp/protected-tool-spy.ts';

const resourceMetadataUrl = 'http://localhost:8080/.well-known/oauth-protected-resource/mcp';
const productAccess = ProtectedToolSpy.requiredPermission;
const alice: AccountCredentials = { email: 'alice@example.com', password: passwordOf('alice@example.com') };
const bob: AccountCredentials = { email: 'bob@example.com', password: passwordOf('bob@example.com') };
const carol: AccountCredentials = { email: 'carol@example.com', password: passwordOf('carol@example.com') };

interface LocalInstallationUnderTest {
  readonly runtime: BetterAuthRuntime;
  readonly native: PreRegisteredNativeClient;
  readonly resourceServer: ResourceServerClient;
  readonly userIds: ReadonlyMap<string, string>;
}

interface McpServerUnderTest {
  readonly server: MCPServer;
  readonly probe: ProtectedToolSpy;
  readonly reporter: FailureReporterSpy;
}

async function openRuntime(t: TestContext, directory: string): Promise<BetterAuthRuntime> {
  const runtime = await openBetterAuthRuntime(selfHostedConfig(directory));
  t.after(() => runtime.close());
  return runtime;
}

async function registerNativeClient(auth: LocalAuth, account: AccountCredentials): Promise<string> {
  const client = await withRegistrationSession(auth, account, (headers) => auth.api.adminCreateOAuthClient({
    headers,
    body: {
      client_name: 'Native MCP client',
      redirect_uris: [loopbackRedirectUri],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code'],
      response_types: ['code'],
      application_type: 'native',
    },
  }));
  return client.client_id;
}

async function localInstallation(t: TestContext, accounts: readonly AccountCredentials[] = [alice, bob], directory = dataDirectory(t)): Promise<LocalInstallationUnderTest> {
  const runtime = await openRuntime(t, directory);
  const userIds = new Map<string, string>();
  for (const { email } of accounts) userIds.set(email, await addAccount(runtime, email));
  const native = new PreRegisteredNativeClient(runtime.auth, await registerNativeClient(runtime.auth, alice));
  return { runtime, native, resourceServer: await resourceServerClient(runtime.auth, alice), userIds };
}

function providerFor(runtime: BetterAuthRuntime, resourceServer: ResourceServerClient | undefined): BetterAuthProvider {
  return new BetterAuthProvider(runtime.auth, {
    issuer: authIssuer,
    mcpResourceUrl,
    installationId: runtime.installationId,
    resourceServerClient: resourceServer,
  });
}

function mcpServer(t: TestContext, provider: BetterAuthProvider, requiredScopes?: readonly string[]): McpServerUnderTest {
  const probe = new ProtectedToolSpy();
  const reporter = new FailureReporterSpy();
  const server = new MCPServer({
    auth: { verifier: provider, accessResolver: provider, resourceMetadataUrl, expectedResource: new URL(mcpResourceUrl), requiredScopes },
    buildServer: probe.buildServer,
    reportFailure: reporter.report,
  });
  t.after(() => server.close());
  return { server, probe, reporter };
}

function callProbe(t: TestContext, token: string, url = 'https://example.com/page'): Request {
  return mcpRequest({
    url: mcpResourceUrl,
    method: 'tools/call',
    token,
    params: { name: ProtectedToolSpy.toolName, arguments: { url } },
    signal: t.signal,
  });
}

async function grantsFor(installation: LocalInstallationUnderTest, accounts: readonly AccountCredentials[]): Promise<UserGrant[]> {
  const grants = [];
  for (const account of accounts) grants.push(await userGrant(installation.runtime.auth, installation.native, account));
  return grants;
}

async function opaqueAccessToken(auth: LocalAuth, clientId: string, browser: HttpAgent): Promise<string> {
  const verifier = randomBytes(32).toString('base64url');
  const query = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: loopbackRedirectUri,
    scope: 'openid',
    state: 'integration-state',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
  });
  const callback = await followAuthorizationWithConsent(browser, `/api/auth/oauth2/authorize?${query}`);
  const response = await new HttpAgent(auth).request('POST', '/api/auth/oauth2/token', {
    origin: null,
    form: { grant_type: 'authorization_code', code: callback.searchParams.get('code') ?? '', redirect_uri: loopbackRedirectUri, code_verifier: verifier, client_id: clientId },
  });
  assert.equal(response.status, 200, await response.clone().text());
  return (await response.json() as TokenResponse).access_token;
}

function changedPayload(token: string, claim: string, value: unknown): string {
  const [header, payload, signature] = token.split('.');
  const claims = JSON.parse(Buffer.from(payload ?? '', 'base64url').toString('utf8'));
  return [header, Buffer.from(JSON.stringify({ ...claims, [claim]: value })).toString('base64url'), signature].join('.');
}

interface Refusal {
  readonly response: Response;
  readonly status: number;
  readonly label: string;
}

async function assertRefused(server: McpServerUnderTest, { response, status, label }: Refusal): Promise<void> {
  assert.equal(response.status, status, `${label}: ${await response.clone().text()}`);
  assert.deepEqual(server.probe.work, [], label);
}

describe('Local MCP access with the real Better Auth provider and SQLite', () => {
  guardOutboundFetch({
    refusal: 'Outbound network access is not allowed in the local access tests',
    finding: 'the local provider and the MCP verifier made no outbound request',
  });

  test('Given two local users with session-bound MCP tokens, when each calls the protected tool, then each request works with its own user subject in the one installation tenant, both have the same evaluation grant, and the verified claims name the local issuer, the approved client, and the MCP resource', { timeout: 60_000 }, async (t) => {
    const installation = await localInstallation(t);
    const provider = providerFor(installation.runtime, installation.resourceServer);
    const mcp = mcpServer(t, provider);
    const [aliceGrant, bobGrant] = await grantsFor(installation, [alice, bob]) as [UserGrant, UserGrant];

    const reports = [
      await toolJson<ProbeReport>(await mcp.server.fetch(callProbe(t, aliceGrant.accessToken, 'https://example.com/alice'))),
      await toolJson<ProbeReport>(await mcp.server.fetch(callProbe(t, bobGrant.accessToken, 'https://example.com/bob'))),
    ];

    const authority = `better-auth:${installation.runtime.installationId}`;
    for (const [index, grant] of [aliceGrant, bobGrant].entries()) {
      assert.deepEqual(reports[index]?.context, {
        user: { authority, subject: grant.id },
        tenantId: installation.runtime.tenantId,
        grants: [{ role: 'user', permissions: [productAccess] }],
        permissions: [productAccess],
      });
      assert.deepEqual(reports[index]?.claims, {
        user: { authority, subject: grant.id },
        issuer: authIssuer,
        clientId: installation.native.clientId,
        scopes: ['openid'],
        issuedAt: jwtClaims(grant.accessToken).iat,
        expiresAt: jwtClaims(grant.accessToken).exp,
        audience: mcpResourceUrl,
      });
    }
    assert.deepEqual(LOCAL_USER_GRANT, { role: 'user', permissions: [productAccess] });
    assert.notEqual(aliceGrant.id, bobGrant.id);
    assert.notEqual(jwtClaims(aliceGrant.accessToken).sid, jwtClaims(bobGrant.accessToken).sid);
    assert.deepEqual(mcp.probe.work.map(({ step, subject, tenantId }) => `${step}:${subject}:${tenantId}`), [
      `fetch:${aliceGrant.id}:${installation.runtime.tenantId}`, `clean:${aliceGrant.id}:${installation.runtime.tenantId}`,
      `fetch:${bobGrant.id}:${installation.runtime.tenantId}`, `clean:${bobGrant.id}:${installation.runtime.tenantId}`,
    ]);
    assert.deepEqual(mcp.reporter.reports, []);
  });

  test('Given a user disabled while its browser session and token stay valid and a deleted user, when each calls the protected tool, then access resolution denies the disabled user with 403 after token verification, the deleted user gets 401, no tool runs for them, and the peer still works', { timeout: 60_000 }, async (t) => {
    const installation = await localInstallation(t, [alice, bob, carol]);
    const mcp = mcpServer(t, providerFor(installation.runtime, installation.resourceServer));
    const [aliceGrant, bobGrant, carolGrant] = await grantsFor(installation, [alice, bob, carol]) as [UserGrant, UserGrant, UserGrant];
    const { internalAdapter } = await installation.runtime.auth.$context;

    await internalAdapter.updateUser(bobGrant.id, { banned: true, banExpires: null });
    await internalAdapter.deleteUser(carolGrant.id);
    const disabled = await mcp.server.fetch(callProbe(t, bobGrant.accessToken));
    const deleted = await mcp.server.fetch(callProbe(t, carolGrant.accessToken));
    const peer = await toolJson<ProbeReport>(await mcp.server.fetch(callProbe(t, aliceGrant.accessToken)));

    assert.equal(disabled.status, 403);
    assert.equal(disabled.headers.get('WWW-Authenticate'), null);
    assert.equal(await errorCodeOf(disabled), 'access_denied');
    assert.equal(deleted.status, 401);
    assert.equal(peer.context.user.subject, aliceGrant.id);
    assert.deepEqual(mcp.probe.contexts.map(({ user }) => user.subject), [aliceGrant.id]);
    assert.deepEqual(mcp.reporter.reports, []);
  });

  test('Given two users with MCP tokens, when one user\'s sessions end, then introspection makes only that user\'s token fail with 401 and the peer keeps working with its token', { timeout: 60_000 }, async (t) => {
    const installation = await localInstallation(t);
    const mcp = mcpServer(t, providerFor(installation.runtime, installation.resourceServer));
    const [aliceGrant, bobGrant] = await grantsFor(installation, [alice, bob]) as [UserGrant, UserGrant];

    await (await installation.runtime.auth.$context).internalAdapter.deleteUserSessions(aliceGrant.id);
    const revoked = await mcp.server.fetch(callProbe(t, aliceGrant.accessToken));
    await assertRefused(mcp, { response: revoked, status: 401, label: 'the revoked token' });

    const peer = await toolJson<ProbeReport>(await mcp.server.fetch(callProbe(t, bobGrant.accessToken)));
    assert.equal(peer.context.user.subject, bobGrant.id);
    assert.deepEqual(mcp.reporter.reports, []);
  });

  test('Given two users with active MCP tokens, when protected requests exceed the shared provider rate limit, then all requests keep working and the next request still checks whether its session ended', { timeout: 60_000 }, async (t) => {
    const installation = await localInstallation(t);
    const mcp = mcpServer(t, providerFor(installation.runtime, installation.resourceServer));
    const grants = await grantsFor(installation, [alice, bob]) as [UserGrant, UserGrant];

    for (let request = 0; request < 110; request += 1) {
      const grant = request % 2 === 0 ? grants[0] : grants[1];
      const response = await mcp.server.fetch(callProbe(t, grant.accessToken));
      assert.equal(response.status, 200, `protected request ${request + 1}: ${await response.clone().text()}`);
      assert.equal((await toolJson<ProbeReport>(response)).context.user.subject, grant.id);
    }

    const workBeforeRevocation = [...mcp.probe.work];
    await (await installation.runtime.auth.$context).internalAdapter.deleteUserSessions(grants[0].id);
    const revoked = await mcp.server.fetch(callProbe(t, grants[0].accessToken));
    assert.equal(revoked.status, 401);
    assert.deepEqual(mcp.probe.work, workBeforeRevocation);
    assert.equal((await mcp.server.fetch(callProbe(t, grants[1].accessToken))).status, 200);
    assert.deepEqual(mcp.reporter.reports, []);
  });

  test('Given tokens that each fail one check — a changed payload, the token of another installation, an ID token, an access token without the MCP resource, an expired token, and a malformed value — when each calls the MCP endpoint, then each gets 401 before any tool runs and the operator gets no failure report', { timeout: 60_000 }, async (t) => {
    const installation = await localInstallation(t);
    const foreign = await localInstallation(t);
    const mcp = mcpServer(t, providerFor(installation.runtime, installation.resourceServer));
    const browser = new HttpAgent(installation.runtime.auth);
    assert.equal((await browser.signIn(alice.email, alice.password)).status, 200);
    const tokens = await installation.native.authorize(browser) as TokenResponse & { readonly id_token?: string };
    const foreignToken = (await userGrant(foreign.runtime.auth, foreign.native, alice)).accessToken;
    const opaqueToken = await opaqueAccessToken(installation.runtime.auth, installation.native.clientId, browser);
    assert.ok(tokens.id_token, 'the token response has an ID token for the openid scope');

    const refusals = [
      { label: 'a changed payload', token: changedPayload(tokens.access_token, 'sub', 'someone-else') },
      { label: 'another installation', token: foreignToken },
      { label: 'an ID token', token: tokens.id_token },
      { label: 'no MCP resource', token: opaqueToken },
      { label: 'a malformed value', token: 'not-a-token' },
    ];
    for (const { label, token } of refusals) await assertRefused(mcp, { response: await mcp.server.fetch(callProbe(t, token)), status: 401, label });
    t.mock.timers.enable({ apis: ['Date'], now: (Number(jwtClaims(tokens.access_token).exp) + 60) * 1_000 });
    const expired = await mcp.server.fetch(callProbe(t, tokens.access_token));
    t.mock.timers.reset();
    await assertRefused(mcp, { response: expired, status: 401, label: 'an expired token' });

    assert.deepEqual(mcp.probe.contexts, []);
    assert.deepEqual(mcp.reporter.reports, []);
    assert.equal((await toolJson<ProbeReport>(await mcp.server.fetch(callProbe(t, tokens.access_token)))).context.user.subject, installation.userIds.get(alice.email));
  });

  test('Given an MCP server that requires the openid scope, when a user calls with a token granted only the profile scope, then the SDK answers 403 insufficient_scope with the required scope in its challenge and no tool runs', { timeout: 60_000 }, async (t) => {
    const installation = await localInstallation(t);
    const mcp = mcpServer(t, providerFor(installation.runtime, installation.resourceServer), ['openid']);
    const browser = new HttpAgent(installation.runtime.auth);
    assert.equal((await browser.signIn(alice.email, alice.password)).status, 200);
    const profileOnly = await installation.native.authorize(browser, 'profile');

    const response = await mcp.server.fetch(callProbe(t, profileOnly.access_token));

    assert.equal(profileOnly.scope, 'profile');
    await assertRefused(mcp, { response, status: 403, label: 'a token without the required scope' });
    const challenge = response.headers.get('WWW-Authenticate') ?? '';
    assert.match(challenge, /error="insufficient_scope"/);
    assert.match(challenge, /scope="openid"/);
    assert.deepEqual(mcp.reporter.reports, []);
  });

  test('Given no resource-server client or one with a wrong secret, when a user calls with a valid token, then the client gets a generic 500, the operator gets one token-verification report without the token, and no tool runs', { timeout: 60_000 }, async (t) => {
    const installation = await localInstallation(t);
    const [aliceGrant] = await grantsFor(installation, [alice]) as [UserGrant];

    for (const resourceServer of [undefined, { clientId: installation.resourceServer.clientId, clientSecret: 'wrong-client-secret' }]) {
      const mcp = mcpServer(t, providerFor(installation.runtime, resourceServer));
      const response = await mcp.server.fetch(callProbe(t, aliceGrant.accessToken));

      await assertRefused(mcp, { response, status: 500, label: resourceServer === undefined ? 'no resource-server client' : 'a wrong secret' });
      assert.deepEqual(mcp.reporter.reports.map(({ step }) => step), ['token-verification']);
      assert.ok(!inspect(mcp.reporter.reports, { depth: Infinity }).includes(aliceGrant.accessToken), 'the report holds the token');
      assert.ok(!(await response.text()).includes('client'), 'the response names the private failure');
    }
  });

  test('Given a user with a token, a consent, and a pending authorization code, when the operator disables the user, then sign-in is refused, the pending code and a refresh request fail, a new authorization asks for a sign-in, the token gets 401, and the peer keeps working', { timeout: 60_000 }, async (t) => {
    const installation = await localInstallation(t);
    const mcp = mcpServer(t, providerFor(installation.runtime, installation.resourceServer));
    const [aliceGrant, bobGrant] = await grantsFor(installation, [alice, bob]) as [UserGrant, UserGrant];
    const pending = installation.native.authorizationRequest();
    const pendingCallback = await followAuthorizationWithConsent(bobGrant.browser, pending.path);
    const { internalAdapter } = await installation.runtime.auth.$context;

    await internalAdapter.updateUser(bobGrant.id, { banned: true, banExpires: null });
    await internalAdapter.deleteUserSessions(bobGrant.id);
    const signIn = await new HttpAgent(installation.runtime.auth).signIn(bob.email, bob.password);
    const exchange = await installation.native.exchange(pendingCallback, pending.verifier);
    const refresh = await installation.native.refresh(bobGrant.accessToken);
    const authorization = await bobGrant.browser.request('GET', installation.native.authorizationRequest().path, { origin: null });
    const token = await mcp.server.fetch(callProbe(t, bobGrant.accessToken));

    assert.equal(signIn.status, 403);
    assert.equal(await errorCodeOf(signIn), 'BANNED_USER');
    assert.equal(exchange.status, 400);
    assert.equal(refresh.status, 400);
    assert.equal(await errorCodeOf(refresh), 'unsupported_grant_type');
    assert.match(authorization.headers.get('Location') ?? '', /^\/sign-in\?/);
    await assertRefused(mcp, { response: token, status: 401, label: 'the disabled user\'s token' });

    const peer = await toolJson<ProbeReport>(await mcp.server.fetch(callProbe(t, aliceGrant.accessToken)));
    assert.equal(peer.context.user.subject, aliceGrant.id);
  });

  test('Given a user with a token and a consent, when the runtime closes and opens again on the same data directory, then the token is still accepted and a new authorization needs no sign-in or consent, because keys, sessions, clients, and consents persist', { timeout: 60_000 }, async (t) => {
    const directory = dataDirectory(t);
    const installation = await localInstallation(t, [alice], directory);
    const [aliceGrant] = await grantsFor(installation, [alice]) as [UserGrant];
    await installation.runtime.close();

    const reopened = await openRuntime(t, directory);
    const mcp = mcpServer(t, providerFor(reopened, installation.resourceServer));
    const report = await toolJson<ProbeReport>(await mcp.server.fetch(callProbe(t, aliceGrant.accessToken)));
    const native = new PreRegisteredNativeClient(reopened.auth, installation.native.clientId);
    const browser = new HttpAgent(reopened.auth, aliceGrant.browser.cookies);
    const silent = await browser.request('GET', native.authorizationRequest().path, { origin: null });

    assert.equal(reopened.installationId, installation.runtime.installationId);
    assert.equal(report.context.user.subject, aliceGrant.id);
    assert.equal(report.context.tenantId, reopened.tenantId);
    assert.ok((silent.headers.get('Location') ?? '').startsWith(`${loopbackRedirectUri}?`), silent.headers.get('Location') ?? '');
  });

  test('Given the approved native client, when authorizations use its exact redirect URI, another loopback port, another path, a client metadata URL, and an unknown client, then only the registered redirect URI, on any loopback port, gets a code, and the others go to the bundled authorization error page', { timeout: 60_000 }, async (t) => {
    const installation = await localInstallation(t, [alice]);
    const browser = new HttpAgent(installation.runtime.auth);
    assert.equal((await browser.signIn(alice.email, alice.password)).status, 200);
    await installation.native.authorize(browser);
    const authorization = async (query: Readonly<Record<string, string>>) => {
      const request = new URLSearchParams(installation.native.authorizationRequest().path.split('?')[1]);
      for (const [name, value] of Object.entries(query)) request.set(name, value);
      return new URL((await browser.request('GET', `/api/auth/oauth2/authorize?${request}`, { origin: null })).headers.get('Location') ?? '', authIssuer);
    };

    const exact = await authorization({});
    const otherPort = await authorization({ redirect_uri: 'http://127.0.0.1:44444/callback' });
    const refused = [
      await authorization({ redirect_uri: 'http://127.0.0.1:33418/other' }),
      await authorization({ client_id: 'https://client.example/oauth/client-metadata.json' }),
      await authorization({ client_id: 'unknown-client' }),
    ];

    assert.ok(exact.searchParams.get('code'), exact.href);
    assert.equal(`${otherPort.origin}${otherPort.pathname}`, 'http://127.0.0.1:44444/callback');
    assert.ok(otherPort.searchParams.get('code'), otherPort.href);
    assert.deepEqual(refused.map((location) => `${location.origin}${location.pathname}`), refused.map(() => 'http://localhost:8080/authorization-error'));
    assert.deepEqual(refused.map((location) => location.searchParams.get('error')), ['invalid_redirect', 'invalid_client', 'invalid_client']);
  });
});
