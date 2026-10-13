import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import { UnauthorizedError } from '@modelcontextprotocol/client';
import { jwtClaims, loopbackRedirectUri } from '../../support/better-auth-agents.ts';
import { authIssuer, mcpResourceUrl, publicBaseUrl, type AccountCredentials } from '../../support/better-auth-local.ts';
import { assertExit, assertRevealsNone, type CommandResult } from '../../support/command-process.ts';
import { dataDirectory } from '../../support/data-directory.ts';
import { hiddenField, LocalBrowser } from '../../support/local-browser.ts';
import { addUser, listedAccounts, operatorOn, registerArgs, registeredClientId, type Operator } from '../../support/local-commands.ts';
import { LocalMcpUser } from '../../support/local-mcp-user.ts';
import { selfHostedSettings, withRuntime } from '../../support/local-runtime.ts';
import { ServerProcess } from '../../support/server-process.ts';

const alice: AccountCredentials = { email: 'alice@example.com', password: 'alice-password-1' };
const bob: AccountCredentials = { email: 'bob@example.com', password: 'bob-password-1' };
const foreignOrigin = 'https://evil.example';
const tenantLine = /The self-hosted installation uses tenant (local:[0-9a-f-]{36})\./;

interface Installation {
  readonly directory: string;
  readonly operator: Operator;
  readonly clientId: string;
  readonly userIds: ReadonlyMap<string, string>;
  readonly commands: CommandResult[];
}

async function installation(t: TestContext, accounts: readonly AccountCredentials[] = [alice, bob]): Promise<Installation> {
  const directory = dataDirectory(t);
  const operator = operatorOn(t, directory);
  const commands: CommandResult[] = [];
  for (const account of accounts) commands.push(await addUser(operator, account));
  const registration = await operator(registerArgs(alice), [alice.password]);
  commands.push(registration);
  for (const result of commands) assertExit(result, 0);
  const userIds = new Map((await listedAccounts(operator)).map(({ email, id }) => [email, id] as const));
  return { directory, operator, clientId: registeredClientId(registration), userIds, commands };
}

// The server can restart on another port; the users' browsers and MCP clients follow it and keep their state.
class RunningServer {
  private current?: ServerProcess;
  private url?: URL;
  readonly outputs: string[] = [];

  readonly address = (): URL => {
    assert.ok(this.url, 'the server is not running');
    return this.url;
  };

  async start(t: TestContext, directory: string): Promise<ServerProcess> {
    this.current = await ServerProcess.start(t, selfHostedSettings(directory));
    this.url = await this.current.started();
    return this.current;
  }

  async stop(): Promise<void> {
    assert.ok(this.current, 'the server is not running');
    assert.deepEqual(await this.current.stop(), { code: 0, signal: null });
    this.outputs.push(this.current.output);
    this.current = undefined;
    this.url = undefined;
  }

  async request(path: string, init: RequestInit = {}): Promise<Response> {
    return fetch(new URL(path, this.address()), init);
  }
}

function assertNoOutboundAccess(server: RunningServer, commands: readonly CommandResult[]): void {
  for (const output of server.outputs) assert.doesNotMatch(output, /Outbound network access attempted/);
  assertRevealsNone(commands, []);
}

async function refreshAttempt(server: RunningServer, clientId: string, token: string): Promise<Response> {
  return server.request('/api/auth/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: token, client_id: clientId, resource: mcpResourceUrl }),
  });
}

async function assertNoRefreshGrant(server: RunningServer, clientId: string, token: string): Promise<void> {
  const refresh = await refreshAttempt(server, clientId, token);
  assert.equal(refresh.status, 400);
  assert.equal((await refresh.json() as { error?: string }).error, 'unsupported_grant_type');
}

async function toolNames(user: LocalMcpUser, t: TestContext): Promise<string[]> {
  const { tools } = await (await user.connectWithSavedToken(t)).listTools();
  return tools.map(({ name }) => name);
}

describe('Self-hosted browser-to-MCP authorization without outbound access', () => {
  test('Given two enabled accounts and two approved native clients, when each user\'s MCP SDK client starts the authorization and the user signs in and consents on the bundled pages, then each client works with a resource-bound token for its own user and browser session and no refresh token, in the one installation workspace; when a token is no longer accepted, the client authorizes again through the live browser session without the pages, and no process uses the network', { timeout: 120_000 }, async (t) => {
    const { directory, operator, clientId, userIds, commands } = await installation(t);
    const secondRegistration = await operator(registerArgs(bob), [bob.password]);
    const secondClientId = registeredClientId(secondRegistration);
    commands.push(secondRegistration);
    const server = new RunningServer();
    const serverProcess = await server.start(t, directory);
    const users = [new LocalMcpUser(server.address, clientId, alice), new LocalMcpUser(server.address, secondClientId, bob)];

    const connections = [];
    for (const user of users) connections.push(await user.connect(t));
    const workspaces = [];
    for (const { client } of connections) workspaces.push((await client.listTools()).tools);
    const [aliceUser, bobUser] = users as [LocalMcpUser, LocalMcpUser];
    const firstAliceToken = aliceUser.accessToken;
    aliceUser.oauth.expireAccessToken();
    const reauthorization = await aliceUser.connect(t);

    assert.deepEqual(connections.map(({ pages }) => pages), [['/sign-in', '/consent'], ['/sign-in', '/consent']]);
    assert.notEqual(clientId, secondClientId);
    for (const [index, user] of users.entries()) {
      const claims = jwtClaims(user.accessToken);
      assert.equal(claims.sub, userIds.get(user.account.email));
      assert.equal(claims.iss, authIssuer);
      assert.equal(claims.client_id, [clientId, secondClientId][index]);
      assert.ok(Array.isArray(claims.aud) && claims.aud.includes(mcpResourceUrl), JSON.stringify(claims.aud));
      assert.equal(user.oauth.savedTokens().refresh_token, undefined);
    }
    assert.notEqual(jwtClaims(firstAliceToken).sid, jwtClaims(bobUser.accessToken).sid);
    assert.deepEqual(workspaces[0], workspaces[1]);
    assert.deepEqual(reauthorization.pages, []);
    assert.notEqual(aliceUser.accessToken, firstAliceToken);
    assert.equal(jwtClaims(aliceUser.accessToken).sid, jwtClaims(firstAliceToken).sid);
    assert.deepEqual(await toolNames(aliceUser, t), await toolNames(bobUser, t));
    await assertNoRefreshGrant(server, clientId, aliceUser.accessToken);
    assert.match(serverProcess.output, tenantLine);
    await server.stop();
    assertNoOutboundAccess(server, commands);
  });

  test('Given two users with MCP tokens, when the operator resets one user\'s password while the server is stopped, then after the restart that user\'s old password, old token, and a refresh request fail, the user signs in with the new password and gets a new token without a new consent, and the peer\'s token, session, and consent still work', { timeout: 120_000 }, async (t) => {
    const { directory, operator, clientId, userIds, commands } = await installation(t);
    const server = new RunningServer();
    await server.start(t, directory);
    const [aliceUser, bobUser] = [new LocalMcpUser(server.address, clientId, alice), new LocalMcpUser(server.address, clientId, bob)];
    for (const user of [aliceUser, bobUser]) await user.connect(t);
    const oldAliceToken = aliceUser.accessToken;
    await server.stop();

    const reset = await operator(['users', 'reset-password', alice.email], ['alice-password-2', 'alice-password-2']);
    await server.start(t, directory);
    await assert.rejects(aliceUser.connectWithSavedToken(t), UnauthorizedError);
    const signIn = await aliceUser.browser.openSignIn(aliceUser.authorizationUrl());
    const oldPassword = await aliceUser.browser.post(signIn.url, { email: alice.email, password: alice.password, oauth_query: signIn.oauthQuery });
    const renewed = await aliceUser.connect(t, { email: alice.email, password: 'alice-password-2' });
    const peerTools = await toolNames(bobUser, t);
    bobUser.oauth.expireAccessToken();
    const peerReauthorization = await bobUser.connect(t);

    assertExit(reset, 0);
    assert.equal(oldPassword.status, 401);
    assert.equal(oldPassword.location, undefined);
    assert.match(oldPassword.body, /email address or password is not correct/i);
    assert.ok(!oldPassword.body.includes(alice.password), 'the page repeats the password');
    await assertNoRefreshGrant(server, clientId, oldAliceToken);
    assert.deepEqual(renewed.pages, ['/sign-in']);
    assert.equal(jwtClaims(aliceUser.accessToken).sub, userIds.get(alice.email));
    assert.notEqual(aliceUser.accessToken, oldAliceToken);
    assert.deepEqual(peerTools, []);
    assert.deepEqual(peerReauthorization.pages, []);
    await server.stop();
    assertNoOutboundAccess(server, [...commands, reset]);
  });

  test('Given two users with MCP tokens, when the operator disables one user while the server is stopped, then after the restart that user\'s token is refused, the sign-in page refuses the account, no new token and no refresh is possible, and the peer keeps working with its token', { timeout: 120_000 }, async (t) => {
    const { directory, operator, clientId, commands } = await installation(t);
    const server = new RunningServer();
    await server.start(t, directory);
    const [aliceUser, bobUser] = [new LocalMcpUser(server.address, clientId, alice), new LocalMcpUser(server.address, clientId, bob)];
    for (const user of [aliceUser, bobUser]) await user.connect(t);
    const oldBobToken = bobUser.accessToken;
    await server.stop();

    const disable = await operator(['users', 'disable', bob.email]);
    await server.start(t, directory);
    await assert.rejects(bobUser.connectWithSavedToken(t), UnauthorizedError);
    const signIn = await bobUser.browser.openSignIn(bobUser.authorizationUrl());
    const disabledSignIn = await bobUser.browser.post(signIn.url, { email: bob.email, password: bob.password, oauth_query: signIn.oauthQuery });
    const peerTools = await toolNames(aliceUser, t);

    assertExit(disable, 0);
    assert.equal(disabledSignIn.status, 403);
    assert.equal(disabledSignIn.location, undefined);
    assert.match(disabledSignIn.body, /account is disabled/i);
    assert.equal(bobUser.browser.cookies.size, 0, 'the refused sign-in set no session cookie');
    await assertNoRefreshGrant(server, clientId, oldBobToken);
    assert.deepEqual(peerTools, []);
    await server.stop();
    assertNoOutboundAccess(server, [...commands, disable]);
  });

  test('Given a running server, when a client reads both discovery documents and tries public signup, dynamic registration, a client metadata URL as client ID, an unregistered redirect URI, and the private provider routes, then the documents describe only the local provider, nothing creates an account or a client, and the server fetches nothing', { timeout: 120_000 }, async (t) => {
    const { directory, clientId, commands } = await installation(t, [alice]);
    const server = new RunningServer();
    await server.start(t, directory);
    const browser = new LocalBrowser(server.address);
    const authorize = (query: Readonly<Record<string, string>>) => browser.navigate(`/api/auth/oauth2/authorize?${new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: loopbackRedirectUri,
      scope: 'openid',
      state: 'acceptance-state',
      code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      code_challenge_method: 'S256',
      resource: mcpResourceUrl,
      ...query,
    })}`);

    const challenge = await server.request('/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: '{}' });
    const resourceMetadata = await server.request('/.well-known/oauth-protected-resource/mcp');
    const rootResourceMetadata = await server.request('/.well-known/oauth-protected-resource');
    const serverMetadata = await server.request('/.well-known/oauth-authorization-server/api/auth');
    const openIdMetadata = await server.request('/api/auth/.well-known/openid-configuration');
    const closed = await Promise.all([
      ['POST', '/api/auth/sign-up/email'],
      ['POST', '/api/auth/oauth2/register'],
      ['POST', '/api/auth/oauth2/introspect'],
      ['POST', '/api/auth/sign-in/email'],
      ['GET', '/api/auth/get-session'],
      ['POST', '/api/auth/oauth2/public-client-prelogin'],
      ['GET', '/api/auth/oauth2/public-client'],
      ['POST', '/api/auth/admin/create-user'],
      ['POST', '/api/auth/oauth2/create-client'],
      ['POST', '/api/auth/admin/oauth2/create-client'],
      ['GET', '/api/auth/token'],
    ].map(async ([method, path]) => (await server.request(path as string, {
      method,
      headers: { 'Content-Type': 'application/json', Origin: publicBaseUrl },
      ...(method === 'POST' ? { body: JSON.stringify({ email: 'eve@example.com', password: 'eve-password-1', name: 'Eve', redirect_uris: [loopbackRedirectUri] }) } : {}),
    })).status));
    const metadataClient = await authorize({ client_id: 'https://client.example/oauth/client-metadata.json' });
    const unregisteredRedirect = await authorize({ redirect_uri: 'http://127.0.0.1:33418/other' });
    const errorPages = await Promise.all([metadataClient, unregisteredRedirect].map(async ({ status, location }) => {
      assert.ok(location, `the provider answered ${status} without a redirect`);
      assert.equal(location.pathname, '/authorization-error', location.href);
      return { code: location.searchParams.get('error'), page: await browser.navigate(location, 'same-origin') };
    }));

    assert.equal(challenge.status, 401);
    assert.match(challenge.headers.get('WWW-Authenticate') ?? '', /resource_metadata="http:\/\/localhost:8080\/\.well-known\/oauth-protected-resource\/mcp"/);
    for (const response of [resourceMetadata, rootResourceMetadata]) {
      assert.equal(response.status, 200);
      const metadata = await response.json() as { resource?: string; authorization_servers?: string[] };
      assert.equal(metadata.resource, mcpResourceUrl);
      assert.deepEqual(metadata.authorization_servers, [authIssuer]);
    }
    for (const response of [serverMetadata, openIdMetadata]) {
      assert.equal(response.status, 200);
      const metadata = await response.json() as Record<string, unknown>;
      assert.equal(metadata.issuer, authIssuer);
      assert.equal(metadata.authorization_endpoint, `${authIssuer}/oauth2/authorize`);
      assert.equal(metadata.token_endpoint, `${authIssuer}/oauth2/token`);
      assert.equal(metadata.registration_endpoint, undefined);
      assert.equal(metadata.client_id_metadata_document_supported, undefined);
      assert.deepEqual(metadata.grant_types_supported, ['authorization_code', 'client_credentials']);
      assert.deepEqual(metadata.scopes_supported, ['openid', 'profile', 'email']);
      assert.deepEqual(metadata.code_challenge_methods_supported, ['S256']);
    }
    assert.deepEqual(closed, closed.map(() => 404));
    assert.deepEqual(errorPages.map(({ code }) => code), ['invalid_client', 'invalid_redirect']);
    for (const { code, page } of errorPages) {
      assert.equal(page.status, 400);
      assert.ok(page.body.includes(code ?? ''), page.body);
      assert.doesNotMatch(page.body, /https?:\/\/(?!localhost:8080)/, 'the error page links to no other site');
    }
    await server.stop();
    assertNoOutboundAccess(server, commands);
    await withRuntime(directory, async ({ auth }) => {
      assert.equal(await (await auth.$context).internalAdapter.countTotalUsers(), 1);
    });
  });

  test('Given the bundled pages, when a sign-in or consent request has an untrusted origin or a changed authorization signature, then the page refuses it, reveals no consent details, and creates no authorization; valid requests still work', { timeout: 120_000 }, async (t) => {
    const { directory, clientId, userIds, commands } = await installation(t, [alice]);
    const server = new RunningServer();
    await server.start(t, directory);
    const user = new LocalMcpUser(server.address, clientId, alice);
    await assert.rejects(user.connectWithSavedToken(t), UnauthorizedError);
    const signIn = await user.browser.openSignIn(user.authorizationUrl());
    const credentials = { email: alice.email, password: alice.password, oauth_query: signIn.oauthQuery };

    const foreignSignIn = await user.browser.post(signIn.url, credentials, { origin: foreignOrigin });
    const crossSiteSignIn = await user.browser.post(signIn.url, credentials, { origin: null, site: 'cross-site' });
    const cookiesAfterRefusals = user.browser.cookies.size;
    const signedIn = await user.browser.post(signIn.url, credentials);
    assert.equal(signedIn.location?.pathname, '/consent', `${signedIn.status} ${signedIn.body}`);
    const tamperedUrl = new URL(signedIn.location);
    tamperedUrl.searchParams.set('sig', 'forged-signature');
    const tamperedPage = await user.browser.navigate(tamperedUrl, 'same-origin');
    const tamperedConsent = await user.browser.post(signedIn.location, { accept: 'yes', oauth_query: tamperedUrl.search.slice(1) });
    assert.equal(tamperedPage.status, 403, tamperedPage.body);
    assert.equal(tamperedConsent.status, 400, tamperedConsent.body);
    for (const refused of [tamperedPage, tamperedConsent]) {
      assert.equal(refused.location, undefined);
      assert.doesNotMatch(refused.body, /<form|Native MCP client|alice@example\.com/);
    }
    const consentPage = await user.browser.navigate(signedIn.location, 'same-origin');
    const consent = { accept: 'yes', oauth_query: hiddenField(consentPage.body, 'oauth_query') };
    const foreignConsent = await user.browser.post(signedIn.location, consent, { origin: foreignOrigin });
    const consentWithoutOrigin = await user.browser.post(signedIn.location, consent, { origin: null });
    const accepted = await user.browser.post(signedIn.location, consent);

    for (const refused of [foreignSignIn, crossSiteSignIn, foreignConsent, consentWithoutOrigin]) {
      assert.equal(refused.status, 403, refused.body);
      assert.equal(refused.location, undefined);
      assert.match(refused.body, /refused/i);
    }
    assert.equal(cookiesAfterRefusals, 0);
    assert.equal(consentPage.status, 200);
    assert.match(consentPage.body, /Native MCP client/);
    assert.match(consentPage.body, /alice@example\.com/);
    assert.equal(`${accepted.location?.origin}${accepted.location?.pathname}`, loopbackRedirectUri);
    assert.ok(accepted.location?.searchParams.get('code'));
    assert.equal(accepted.location?.searchParams.get('iss'), authIssuer);
    await server.stop();
    assertNoOutboundAccess(server, commands);
    await withRuntime(directory, async ({ auth }) => {
      assert.equal((await (await auth.$context).internalAdapter.listSessions(userIds.get(alice.email) ?? '')).length, 1);
    });
  });

  test('Given the bundled sign-in page, when one client address posts more than three sign-ins within ten seconds, then the page answers 429 with a retry delay and signs no one in, also with the correct password', { timeout: 120_000 }, async (t) => {
    const { directory, clientId, commands } = await installation(t, [alice]);
    const server = new RunningServer();
    await server.start(t, directory);
    const user = new LocalMcpUser(server.address, clientId, alice);
    await assert.rejects(user.connectWithSavedToken(t), UnauthorizedError);
    const signIn = await user.browser.openSignIn(user.authorizationUrl());

    const statuses = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      statuses.push((await user.browser.post(signIn.url, { email: alice.email, password: 'wrong-password-1', oauth_query: signIn.oauthQuery })).status);
    }
    const limited = await user.browser.post(signIn.url, { email: alice.email, password: alice.password, oauth_query: signIn.oauthQuery });

    assert.deepEqual(statuses, [401, 401, 401]);
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers['retry-after']) > 0, JSON.stringify(limited.headers));
    assert.equal(limited.location, undefined);
    assert.equal(user.browser.cookies.size, 0);
    await server.stop();
    assertNoOutboundAccess(server, commands);
  });
});
