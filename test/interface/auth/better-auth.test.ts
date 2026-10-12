import assert from 'node:assert/strict';
import { after, before, describe, test, type TestContext } from 'node:test';
import { auth as runMcpAuthorization } from '@modelcontextprotocol/client';
import {
  errorCodeOf,
  followAuthorizationWithConsent,
  HttpAgent,
  jwtClaims,
  loopbackRedirectUri,
  PreRegisteredNativeClient,
  ResourceServerClient,
  type TokenResponse,
} from '../../support/better-auth-agents.ts';
import { authIssuer, mcpResourceUrl, startLocalProvider, type LocalAuth } from '../../support/better-auth-local.ts';
import { PreRegisteredSdkClient, sdkFetch } from '../../support/mcp-sdk-oauth-client.ts';

const unsupportedRefreshRevocation = 'Blocked: the pinned provider keeps offline refresh grants after session deletion, '
  + 'password reset, and disable; docs/design/authentication-design.md records the open decision.';

type UserWithAccountStatus = { readonly id: string; readonly email: string; readonly banned?: boolean | null };

async function localProvider(t: TestContext): Promise<LocalAuth> {
  const { auth, database } = await startLocalProvider();
  t.after(() => database.close());
  return auth;
}

async function createAccount(auth: LocalAuth, email: string, password: string) {
  const { user } = await auth.api.createUser({ body: { email, password, name: email } });
  return user;
}

async function signedIn(auth: LocalAuth, email: string, password: string): Promise<HttpAgent> {
  const browser = new HttpAgent(auth);
  const response = await browser.signIn(email, password);
  assert.equal(response.status, 200, await response.text());
  return browser;
}

async function assertProviderError(call: Promise<unknown>, statusCode: number, code: string): Promise<void> {
  await assert.rejects(call, (error: unknown) => {
    const { statusCode: actualStatus, body } = error as { statusCode?: number; body?: { code?: string } };
    assert.equal(actualStatus, statusCode);
    assert.equal(body?.code, code);
    return true;
  });
}

async function registerClients(auth: LocalAuth, signedInOperator: HttpAgent) {
  const headers = new Headers({ Cookie: signedInOperator.cookieHeader() });
  const native = await auth.api.adminCreateOAuthClient({
    headers,
    body: {
      client_name: 'Native MCP client',
      redirect_uris: [loopbackRedirectUri],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      application_type: 'native',
      skip_consent: true,
    },
  });
  const resourceServer = await auth.api.adminCreateOAuthClient({
    headers,
    body: {
      client_name: 'Magumagu MCP resource server',
      token_endpoint_auth_method: 'client_secret_basic',
      grant_types: ['client_credentials'],
    },
  });
  assert.ok(resourceServer.client_secret, 'a confidential client receives a secret');
  return {
    native: new PreRegisteredNativeClient(auth, native.client_id),
    resourceServer: new ResourceServerClient(auth, resourceServer.client_id, resourceServer.client_secret),
  };
}

async function twoUsersWithGrants(t: TestContext) {
  const auth = await localProvider(t);
  const alice = await createAccount(auth, 'alice@example.com', 'alice-password-1');
  const bob = await createAccount(auth, 'bob@example.com', 'bob-password-1');
  const aliceBrowser = await signedIn(auth, 'alice@example.com', 'alice-password-1');
  const bobBrowser = await signedIn(auth, 'bob@example.com', 'bob-password-1');
  const { native, resourceServer } = await registerClients(auth, aliceBrowser);
  const aliceTokens = await native.authorize(aliceBrowser);
  const bobTokens = await native.authorize(bobBrowser);
  return { auth, alice, bob, aliceBrowser, native, resourceServer, aliceTokens, bobTokens };
}

function refreshTokenOf(tokens: TokenResponse): string {
  assert.ok(tokens.refresh_token, 'an offline grant includes a refresh token');
  return tokens.refresh_token;
}

function assertMcpAudience(token: string): void {
  const audience = jwtClaims(token).aud;
  assert.ok(Array.isArray(audience) && audience.includes(mcpResourceUrl), JSON.stringify(audience));
}

describe('Pinned Better Auth local provider contracts', () => {
  const realFetch = globalThis.fetch;
  const outboundRequests: string[] = [];

  before(() => {
    globalThis.fetch = async (input) => {
      outboundRequests.push(input instanceof Request ? input.url : String(input));
      throw new Error('Outbound network access is not allowed in the local provider');
    };
  });

  after(() => {
    globalThis.fetch = realFetch;
    assert.deepEqual(outboundRequests, [], 'the local provider made no outbound request');
  });

  describe('Private account operations', () => {
    test('Given public signup and email recovery are disabled, when a visitor posts the signup or reset route or the server calls signup, then each is rejected and no account exists', async (t) => {
      const auth = await localProvider(t);
      const visitor = new HttpAgent(auth);

      const response = await visitor.request('POST', '/api/auth/sign-up/email', {
        json: { email: 'eve@example.com', password: 'eve-password-1', name: 'Eve' },
      });
      const serverCall = auth.api.signUpEmail({ body: { email: 'eve@example.com', password: 'eve-password-1', name: 'Eve' } });
      const reset = await visitor.request('POST', '/api/auth/request-password-reset', { json: { email: 'eve@example.com' } });

      assert.equal(response.status, 400);
      assert.equal(await errorCodeOf(response), 'EMAIL_PASSWORD_SIGN_UP_DISABLED');
      await assertProviderError(serverCall, 400, 'EMAIL_PASSWORD_SIGN_UP_DISABLED');
      assert.equal(reset.status, 400);
      assert.equal(await errorCodeOf(reset), 'RESET_PASSWORD_DISABLED');
      assert.equal(await (await auth.$context).internalAdapter.countTotalUsers(), 0);
    });

    test('Given an account, when the private create operation adds the same email in another letter case, then it rejects the duplicate and keeps the original account', async (t) => {
      const auth = await localProvider(t);
      const original = await createAccount(auth, 'alice@example.com', 'alice-password-1');

      const duplicate = createAccount(auth, 'ALICE@Example.com', 'other-password-1');

      await assertProviderError(duplicate, 400, 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL');
      const users = await (await auth.$context).internalAdapter.listUsers();
      assert.deepEqual(users.map(({ id, email }) => ({ id, email })), [{ id: original.id, email: 'alice@example.com' }]);
      assert.equal((await new HttpAgent(auth).signIn('alice@example.com', 'alice-password-1')).status, 200);
    });

    test('Given an enabled and a disabled account, when the private list operation runs, then it returns each ID, email, and state without credentials', async (t) => {
      const auth = await localProvider(t);
      const alice = await createAccount(auth, 'alice@example.com', 'alice-password-1');
      const bob = await createAccount(auth, 'bob@example.com', 'bob-password-1');
      const provider = await auth.$context;
      await provider.internalAdapter.updateUser(bob.id, { banned: true });

      const users = await provider.internalAdapter.listUsers() as UserWithAccountStatus[];

      assert.deepEqual(
        users.map(({ id, email, banned }) => ({ id, email, disabled: banned === true })).sort((a, b) => a.email.localeCompare(b.email)),
        [{ id: alice.id, email: 'alice@example.com', disabled: false }, { id: bob.id, email: 'bob@example.com', disabled: true }],
      );
      for (const user of users) {
        assert.deepEqual(Object.keys(user).filter((field) => /password|secret|hash|token/i.test(field)), []);
      }
    });

    test('Given two signed-in users, when the private reset operation sets a new password and deletes that user\'s sessions, then the old password and session fail, the new password works for the same user, and the peer session remains', async (t) => {
      const auth = await localProvider(t);
      const alice = await createAccount(auth, 'alice@example.com', 'alice-password-1');
      const bob = await createAccount(auth, 'bob@example.com', 'bob-password-1');
      const aliceBrowser = await signedIn(auth, 'alice@example.com', 'alice-password-1');
      const bobBrowser = await signedIn(auth, 'bob@example.com', 'bob-password-1');
      const provider = await auth.$context;

      await provider.internalAdapter.updatePassword(alice.id, await provider.password.hash('alice-password-2'));
      await provider.internalAdapter.deleteUserSessions(alice.id);

      const oldPassword = await new HttpAgent(auth).signIn('alice@example.com', 'alice-password-1');
      assert.equal(oldPassword.status, 401);
      assert.equal(await errorCodeOf(oldPassword), 'INVALID_EMAIL_OR_PASSWORD');
      assert.equal(await aliceBrowser.sessionId(), undefined);
      const newPassword = await new HttpAgent(auth).signIn('alice@example.com', 'alice-password-2');
      assert.equal(newPassword.status, 200);
      assert.equal((await newPassword.json() as { user: { id: string } }).user.id, alice.id);
      assert.ok(await bobBrowser.sessionId());
      assert.equal((await provider.internalAdapter.listSessions(bob.id)).length, 1);
    });

    test('Given two signed-in users, when the private disable operation marks one user banned and deletes that user\'s sessions, then that user cannot sign in, keeps the same ID, and the peer can still sign in', async (t) => {
      const auth = await localProvider(t);
      await createAccount(auth, 'alice@example.com', 'alice-password-1');
      const bob = await createAccount(auth, 'bob@example.com', 'bob-password-1');
      const bobBrowser = await signedIn(auth, 'bob@example.com', 'bob-password-1');
      const provider = await auth.$context;

      await provider.internalAdapter.updateUser(bob.id, { banned: true });
      await provider.internalAdapter.deleteUserSessions(bob.id);

      const login = await new HttpAgent(auth).signIn('bob@example.com', 'bob-password-1');
      assert.equal(login.status, 403);
      assert.equal(await errorCodeOf(login), 'BANNED_USER');
      assert.equal(await bobBrowser.sessionId(), undefined);
      assert.equal((await provider.internalAdapter.findUserByEmail('bob@example.com'))?.user.id, bob.id);
      assert.equal((await new HttpAgent(auth).signIn('alice@example.com', 'alice-password-1')).status, 200);
    });
  });

  describe('MCP authorization and introspection', () => {
    test('Given a pre-registered native client, when a signed-in user authorizes with PKCE and the MCP resource, then the token is a JWT bound to the MCP resource, the user, the client, and the browser session', async (t) => {
      const { alice, aliceBrowser, native, aliceTokens } = await twoUsersWithGrants(t);

      const [header = ''] = aliceTokens.access_token.split('.');
      const claims = jwtClaims(aliceTokens.access_token);

      assert.equal(JSON.parse(Buffer.from(header, 'base64url').toString('utf8')).typ, 'at+jwt');
      assert.equal(claims.iss, authIssuer);
      assert.equal(claims.sub, alice.id);
      assertMcpAudience(aliceTokens.access_token);
      assert.equal(claims.client_id, native.clientId);
      assert.equal(claims.azp, native.clientId);
      assert.equal(claims.scope, 'openid offline_access');
      assert.equal(claims.sid, await aliceBrowser.sessionId());
      assert.equal(Number(claims.exp) - Number(claims.iat), 3_600);
      assert.equal(aliceTokens.token_type, 'Bearer');
      assert.equal(typeof refreshTokenOf(aliceTokens), 'string');
    });

    test('Given an MCP access token, when the linked resource-server client introspects it, then it is active with its claims; a public client, a wrong secret, and an unknown token get no claims', async (t) => {
      const { auth, alice, native, resourceServer, aliceTokens } = await twoUsersWithGrants(t);
      const outsider = new HttpAgent(auth);

      const result = await resourceServer.introspect(aliceTokens.access_token);
      const publicClient = await outsider.request('POST', '/api/auth/oauth2/introspect', {
        origin: null,
        form: { token: aliceTokens.access_token, client_id: native.clientId },
      });
      const wrongSecret = await outsider.request('POST', '/api/auth/oauth2/introspect', {
        origin: null,
        headers: { Authorization: `Basic ${Buffer.from(`${native.clientId}:wrong-secret`).toString('base64')}` },
        form: { token: aliceTokens.access_token },
      });

      assert.equal(result.active, true);
      assert.equal(result.sub, alice.id);
      assert.equal(result.client_id, native.clientId);
      assert.equal(result.iss, authIssuer);
      assert.ok(Array.isArray(result.aud) && result.aud.includes(mcpResourceUrl));
      assert.equal(publicClient.status, 401);
      assert.equal(await errorCodeOf(publicClient), 'invalid_client');
      assert.equal(wrongSecret.status, 401);
      assert.deepEqual(await resourceServer.introspect('unknown-token'), { active: false });
    });

    test('Given two users with MCP access tokens, when one user\'s sessions are deleted, then introspection reports only that user\'s token inactive', async (t) => {
      const { auth, alice, resourceServer, aliceTokens, bobTokens } = await twoUsersWithGrants(t);

      await (await auth.$context).internalAdapter.deleteUserSessions(alice.id);

      assert.deepEqual(await resourceServer.introspect(aliceTokens.access_token), { active: false });
      assert.equal((await resourceServer.introspect(bobTokens.access_token)).active, true);
    });

    test('Given an offline grant, when the client refreshes, then it gets a new resource-bound access token and refresh token, and a repeat of the used refresh token within 30 seconds returns the same response', async (t) => {
      const { alice, native, resourceServer, aliceTokens } = await twoUsersWithGrants(t);

      const first = await native.refresh(refreshTokenOf(aliceTokens));
      const firstTokens = await first.json() as TokenResponse;
      const repeat = await native.refresh(refreshTokenOf(aliceTokens));
      const repeatTokens = await repeat.json() as TokenResponse;

      assert.equal(first.status, 200);
      assert.notEqual(refreshTokenOf(firstTokens), refreshTokenOf(aliceTokens));
      assert.notEqual(firstTokens.access_token, aliceTokens.access_token);
      assert.equal(jwtClaims(firstTokens.access_token).sub, alice.id);
      assertMcpAudience(firstTokens.access_token);
      assert.equal((await resourceServer.introspect(firstTokens.access_token)).active, true);
      assert.equal(repeat.status, 200);
      assert.deepEqual(
        { access: repeatTokens.access_token, refresh: repeatTokens.refresh_token },
        { access: firstTokens.access_token, refresh: firstTokens.refresh_token },
      );
    });

    test('Given the MCP TypeScript SDK client with a pre-registered client ID, when it discovers, authorizes, exchanges the code, and refreshes, then it receives tokens bound to the MCP resource', async (t) => {
      const auth = await localProvider(t);
      const alice = await createAccount(auth, 'alice@example.com', 'alice-password-1');
      const browser = await signedIn(auth, 'alice@example.com', 'alice-password-1');
      const { native } = await registerClients(auth, browser);
      const client = new PreRegisteredSdkClient(native.clientId);
      const fetchFn = sdkFetch(auth);

      const start = await runMcpAuthorization(client, { serverUrl: mcpResourceUrl, fetchFn, scope: 'openid offline_access' });
      const callback = await followAuthorizationWithConsent(browser, client.authorizationPath());
      const exchange = await runMcpAuthorization(client, {
        serverUrl: mcpResourceUrl,
        fetchFn,
        authorizationCode: callback.searchParams.get('code') ?? '',
        iss: callback.searchParams.get('iss') ?? undefined,
      });
      const first = client.savedTokens();
      client.expireAccessToken();
      const refresh = await runMcpAuthorization(client, { serverUrl: mcpResourceUrl, fetchFn });

      assert.deepEqual([start, exchange, refresh], ['REDIRECT', 'AUTHORIZED', 'AUTHORIZED']);
      assert.equal(jwtClaims(first.access_token).sub, alice.id);
      assert.notEqual(client.savedTokens().access_token, first.access_token);
      assertMcpAudience(first.access_token);
      assertMcpAudience(client.savedTokens().access_token);
    });

    test('Given offline discovery, when a client posts the registration route and reads the metadata, then registration is refused and no registration endpoint is advertised', async (t) => {
      const auth = await localProvider(t);
      const client = new HttpAgent(auth);

      const registration = await client.request('POST', '/api/auth/oauth2/register', {
        origin: null,
        json: { redirect_uris: [loopbackRedirectUri], token_endpoint_auth_method: 'none' },
      });
      const resource = await client.request('GET', '/.well-known/oauth-protected-resource/mcp', { origin: null });
      const rootResource = await client.request('GET', '/.well-known/oauth-protected-resource', { origin: null });
      const server = await client.request('GET', '/.well-known/oauth-authorization-server/api/auth', { origin: null });
      const openIdServer = await client.request('GET', '/api/auth/.well-known/openid-configuration', { origin: null });

      assert.equal(registration.status, 403);
      assert.equal(await errorCodeOf(registration), 'access_denied');
      assert.equal(resource.status, 200);
      assert.deepEqual(
        await resource.json(),
        {
          resource: mcpResourceUrl,
          authorization_servers: [authIssuer],
          bearer_methods_supported: ['header'],
          dpop_signing_alg_values_supported: ['EdDSA', 'ES256', 'ES512', 'PS256', 'RS256'],
        },
      );
      assert.equal((await rootResource.json() as { resource?: string }).resource, mcpResourceUrl);
      for (const response of [server, openIdServer]) {
        const metadata = await response.json() as Record<string, unknown>;
        assert.equal(response.status, 200);
        assert.equal(metadata.issuer, authIssuer);
        assert.equal(metadata.registration_endpoint, undefined);
        assert.equal(metadata.introspection_endpoint, `${authIssuer}/oauth2/introspect`);
        assert.deepEqual(metadata.code_challenge_methods_supported, ['S256']);
      }
    });
  });

  describe('Protections on real authentication routes', () => {
    test('Given real authentication routes, when a request has a foreign origin, a missing origin with a cookie, a cross-site login navigation, or a foreign callback URL, then the provider rejects it with 403 and adds no session', async (t) => {
      const auth = await localProvider(t);
      const alice = await createAccount(auth, 'alice@example.com', 'alice-password-1');
      const credentials = { email: 'alice@example.com', password: 'alice-password-1' };
      const signedInBrowser = await signedIn(auth, 'alice@example.com', 'alice-password-1');

      const attempts = [
        { code: 'INVALID_ORIGIN', response: await new HttpAgent(auth).request('POST', '/api/auth/sign-in/email', { origin: 'https://evil.example', json: credentials }) },
        { code: 'MISSING_OR_NULL_ORIGIN', response: await signedInBrowser.request('POST', '/api/auth/sign-out', { origin: null, json: {} }) },
        { code: 'MISSING_OR_NULL_ORIGIN', response: await signedInBrowser.request('POST', '/api/auth/sign-out', { origin: 'null', json: {} }) },
        {
          code: 'CROSS_SITE_NAVIGATION_LOGIN_BLOCKED',
          response: await new HttpAgent(auth).request('POST', '/api/auth/sign-in/email', {
            origin: null,
            headers: { 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document' },
            form: credentials,
          }),
        },
        { code: 'INVALID_CALLBACK_URL', response: await new HttpAgent(auth).request('POST', '/api/auth/sign-in/email', { json: { ...credentials, callbackURL: 'https://evil.example/callback' } }) },
      ];

      for (const { code, response } of attempts) {
        assert.equal(response.status, 403, code);
        assert.equal(await errorCodeOf(response), code);
      }
      assert.equal((await (await auth.$context).internalAdapter.listSessions(alice.id)).length, 1);
      assert.ok(await signedInBrowser.sessionId());
    });

    test('Given rate limiting, when one client address exceeds the sign-in limit, then later attempts get 429 with a retry delay while another address can still sign in', async (t) => {
      const auth = await localProvider(t);
      await createAccount(auth, 'alice@example.com', 'alice-password-1');
      const attacker = new HttpAgent(auth);

      const statuses = [];
      for (let attempt = 0; attempt < 4; attempt += 1) {
        statuses.push((await attacker.signIn('alice@example.com', 'wrong-password')).status);
      }
      const limited = await attacker.signIn('alice@example.com', 'alice-password-1');

      assert.deepEqual(statuses, [401, 401, 401, 429]);
      assert.equal(limited.status, 429);
      assert.ok(Number(limited.headers.get('X-Retry-After')) > 0);
      assert.equal((await new HttpAgent(auth).signIn('alice@example.com', 'alice-password-1')).status, 200);
    });

    test('Given private provider routes, when a signed-in user calls the admin, client-management, or session-JWT route over HTTP, then the router refuses them', async (t) => {
      const auth = await localProvider(t);
      await createAccount(auth, 'alice@example.com', 'alice-password-1');
      const browser = await signedIn(auth, 'alice@example.com', 'alice-password-1');

      const responses = [
        await browser.request('POST', '/api/auth/admin/create-user', { json: { email: 'eve@example.com', password: 'eve-password-1', name: 'Eve' } }),
        await browser.request('POST', '/api/auth/oauth2/create-client', {
          json: { redirect_uris: [loopbackRedirectUri], token_endpoint_auth_method: 'none', application_type: 'native' },
        }),
        await browser.request('GET', '/api/auth/token', { origin: null }),
      ];

      assert.deepEqual(responses.map(({ status }) => status), [404, 404, 404]);
      assert.equal(await (await auth.$context).internalAdapter.countTotalUsers(), 1);
    });
  });

  describe('Revocation of offline grants', () => {
    test('Given two users with offline grants, when one user\'s password is reset through the private operations, then that user\'s old refresh token fails and the peer\'s refresh token still works', { todo: unsupportedRefreshRevocation }, async (t) => {
      const { auth, alice, native, aliceTokens, bobTokens } = await twoUsersWithGrants(t);
      const provider = await auth.$context;

      await provider.internalAdapter.updatePassword(alice.id, await provider.password.hash('alice-password-2'));
      await provider.internalAdapter.deleteUserSessions(alice.id);

      assert.equal((await native.refresh(refreshTokenOf(aliceTokens))).status, 400);
      assert.equal((await native.refresh(refreshTokenOf(bobTokens))).status, 200);
    });

    test('Given a disabled user with an offline grant, when the user\'s refresh token is used, then refresh fails', { todo: unsupportedRefreshRevocation }, async (t) => {
      const { auth, bob, native, bobTokens } = await twoUsersWithGrants(t);
      const provider = await auth.$context;

      await provider.internalAdapter.updateUser(bob.id, { banned: true });
      await provider.internalAdapter.deleteUserSessions(bob.id);

      assert.equal((await native.refresh(refreshTokenOf(bobTokens))).status, 400);
    });
  });
});
