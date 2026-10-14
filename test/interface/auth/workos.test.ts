import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, before, describe, test, type TestContext } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import {
  BadRequestException,
  GenericServerException,
  NotFoundException,
  OauthException,
  UnauthorizedException,
  type OrganizationMembership,
  type RefreshSessionResponse,
  type SendInvitationOptions,
  type UpdateOrganizationMembershipOptions,
  type WorkOS,
} from '@workos-inc/node';
import { createRemoteJWKSet, decodeJwt, errors, jwtVerify, SignJWT, type JWTPayload, type RemoteJWKSetOptions } from 'jose';
import { nowInSeconds, SigningKey, type TokenSettings } from '../../support/jwt-signing-key.ts';
import {
  cookiePassword,
  fakeApiKey,
  fakeClientId,
  refusedLoopbackPort,
  WorkOSFakeApi,
  workosClientFor,
  type FakeAnswer,
  type FakeClientSettings,
} from '../../support/workos-fake-api.ts';

// These proofs show the pinned SDK side of each contract: what it sends, how it reads answers, and how it
// classifies failures. The answers come from a local fake, so they do not show what the real WorkOS API sends.

const redirectUri = 'https://app.magumagu.example/auth/callback';
const mcpResource = 'https://mcp.magumagu.example/mcp';
const codeVerifier = 'pkce-code-verifier-0123456789-abcdefghijklmnop';
const otherCookiePassword = 'another-cookie-password-0123456789-abcdef';
const membershipsRoute = 'GET /user_management/organization_memberships';
const authenticateRoute = 'POST /user_management/authenticate';
const internalError: FakeAnswer = { status: 500, body: { message: 'Internal error' } };

// The build fails if a pinned option type gains or loses a field, for example a version for a conditional update.
const updateOptionFields: Record<keyof UpdateOrganizationMembershipOptions, true> = { roleSlug: true, roleSlugs: true };
const invitationOptionFields: Record<keyof SendInvitationOptions, true> = {
  email: true,
  organizationId: true,
  expiresInDays: true,
  inviterUserId: true,
  roleSlug: true,
  locale: true,
};

const alice = {
  object: 'user',
  id: 'user_01ALICE',
  email: 'alice@example.com',
  email_verified: true,
  first_name: 'Alice',
  last_name: 'Example',
  profile_picture_url: null,
  last_sign_in_at: '2026-10-13T08:00:00.000Z',
  locale: null,
  external_id: null,
  metadata: {},
  created_at: '2026-10-01T08:00:00.000Z',
  updated_at: '2026-10-13T08:00:00.000Z',
};

function browserClaims(changes: JWTPayload = {}): JWTPayload {
  return {
    sub: alice.id,
    sid: 'session_01ALICE',
    jti: 'jti_browser_01',
    org_id: 'org_01ACME',
    role: 'admin',
    roles: ['admin', 'member'],
    permissions: ['members:manage', 'pages:read'],
    ...changes,
  };
}

function connectUserClaims(): JWTPayload {
  return {
    sub: alice.id,
    client_id: 'client_01MCPAPP',
    org_id: 'org_01ACME',
    sid: 'consent_01ALICE',
    scope: 'openid profile email',
    jti: 'jti_connect_01',
  };
}

function authenticationAnswer(accessToken: string, refreshToken: string): FakeAnswer {
  const body = {
    user: alice,
    organization_id: decodeJwt(accessToken).org_id,
    access_token: accessToken,
    refresh_token: refreshToken,
    authentication_method: 'GoogleOAuth',
  };
  return { status: 200, body };
}

function membershipJson(id: string, roleSlugs: readonly string[]) {
  return {
    object: 'organization_membership',
    id,
    user_id: alice.id,
    organization_id: 'org_01ACME',
    organization_name: 'Acme',
    status: 'active',
    directory_managed: false,
    role: { slug: roleSlugs[0] },
    roles: roleSlugs.map((slug) => ({ slug })),
    custom_attributes: {},
    created_at: '2026-10-01T08:00:00.000Z',
    updated_at: '2026-10-13T08:00:00.000Z',
  };
}

function membershipPage(after: string | null): FakeAnswer {
  const lastPage = after === 'om_02';
  const data = lastPage ? [membershipJson('om_03', ['member'])] : [membershipJson('om_01', ['admin']), membershipJson('om_02', ['member'])];
  return { status: 200, body: { object: 'list', data, list_metadata: { before: null, after: lastPage ? null : 'om_02' } } };
}

function roleJson(slug: string, permissions: readonly string[], type: 'EnvironmentRole' | 'OrganizationRole') {
  return {
    object: 'role',
    id: `role_01${slug.toUpperCase()}`,
    name: slug,
    slug,
    description: null,
    permissions,
    type,
    created_at: '2026-10-01T08:00:00.000Z',
    updated_at: '2026-10-01T08:00:00.000Z',
  };
}

function invitationJson(id: string, state: 'pending' | 'revoked') {
  return {
    object: 'invitation',
    id,
    email: 'carol@example.com',
    state,
    accepted_at: null,
    revoked_at: state === 'revoked' ? '2026-10-14T09:00:00.000Z' : null,
    expires_at: '2026-10-21T08:00:00.000Z',
    organization_id: 'org_01ACME',
    inviter_user_id: null,
    accepted_user_id: null,
    role_slug: 'user',
    token: `token_${id}`,
    accept_invitation_url: `https://authkit.example/invite?invitation_token=token_${id}`,
    created_at: '2026-10-14T08:00:00.000Z',
    updated_at: '2026-10-14T08:00:00.000Z',
  };
}

function roleSlugsOf(membership: OrganizationMembership): string[] {
  return (membership.roles ?? [membership.role]).map(({ slug }) => slug);
}

function requestLines(fake: WorkOSFakeApi): string[] {
  return fake.takeRequests().map(({ method, path }) => `${method} ${path}`);
}

function bodiesOf(fake: WorkOSFakeApi): unknown[] {
  return fake.takeRequests().map(({ body }) => body);
}

function refreshTokensSent(fake: WorkOSFakeApi): unknown[] {
  return bodiesOf(fake).map((body) => (body as { refresh_token?: unknown }).refresh_token);
}

const ironSealPart = { encrypted: 4, expiration: 5, hmac: 7 } as const;

function sealWithPart(seal: string, index: number, change: (part: string) => string): string {
  const parts = seal.split('*');
  parts[index] = change(parts[index] ?? '');
  return parts.join('*');
}

function withCharacterAt10(part: string, character: string): string {
  return `${part.slice(0, 10)}${character}${part.slice(11)}`;
}

function isInvalidCharacterError(error: unknown): boolean {
  assert.ok(error instanceof DOMException, String(error));
  assert.equal(error.name, 'InvalidCharacterError');
  return true;
}

function shortenWaitsOfAMinuteOrMore(t: TestContext): number[] {
  const longWaits: number[] = [];
  const realSetTimeout = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (callback: (...args: unknown[]) => void, wait?: number, ...args: unknown[]) => {
    if (wait === undefined || wait < 60_000) return realSetTimeout(callback, wait, ...args);
    longWaits.push(wait);
    return realSetTimeout(callback, 0, ...args);
  });
  return longWaits;
}

interface BrowserSessionWorld {
  readonly fake: WorkOSFakeApi;
  readonly workos: WorkOS;
  readonly browserKey: SigningKey;
}

async function browserSessionWorld(t: TestContext, settings: FakeClientSettings = {}): Promise<BrowserSessionWorld> {
  const fake = await WorkOSFakeApi.start(t);
  const browserKey = await SigningKey.generate('browser-key-1');
  fake.browserKeySet.publish(browserKey);
  return { fake, browserKey, workos: workosClientFor(fake, settings) };
}

function browserToken(world: BrowserSessionWorld, claims = browserClaims(), settings: Partial<TokenSettings> = {}): Promise<string> {
  return world.browserKey.sign(claims, { issuer: world.fake.browserIssuer, ...settings });
}

async function sealedSession(world: BrowserSessionWorld, accessToken: string, refreshToken = 'refresh-1'): Promise<string> {
  world.fake.answer(authenticateRoute, authenticationAnswer(accessToken, refreshToken));
  const { sealedSession: seal } = await world.workos.userManagement.authenticateWithCode({
    code: 'code-1',
    codeVerifier,
    session: { sealSession: true, cookiePassword },
  });
  assert.ok(seal);
  world.fake.takeRequests();
  return seal;
}

async function authenticationOf(workos: WorkOS, seal: string, password = cookiePassword): Promise<string> {
  const result = await workos.userManagement.loadSealedSession({ sessionData: seal, cookiePassword: password }).authenticate();
  return result.authenticated ? 'authenticated' : result.reason;
}

async function authenticatedSession(workos: WorkOS, seal: string) {
  const result = await workos.userManagement.loadSealedSession({ sessionData: seal, cookiePassword }).authenticate();
  if (!result.authenticated) assert.fail(`the seal did not authenticate: ${result.reason}`);
  return result;
}

function refreshOf(workos: WorkOS, seal: string, organizationId?: string): Promise<RefreshSessionResponse> {
  return workos.userManagement.loadSealedSession({ sessionData: seal, cookiePassword }).refresh({ organizationId });
}

function refreshFailure(result: RefreshSessionResponse) {
  if (result.authenticated) assert.fail('the refresh succeeded');
  return { reason: result.reason, retryable: result.retryable, retryAfter: 'retryAfter' in result ? result.retryAfter : undefined };
}

interface ConnectWorld {
  readonly fake: WorkOSFakeApi;
  readonly authkitKey: SigningKey;
  readonly verify: (token: string) => Promise<JWTPayload>;
}

// These are the checks that the hosted MCP verifier will make: the AuthKit key set, the issuer, the MCP audience, and RS256 only.
async function connectWorld(t: TestContext, keySetOptions: RemoteJWKSetOptions = {}): Promise<ConnectWorld> {
  const fake = await WorkOSFakeApi.start(t);
  const authkitKey = await SigningKey.generate('authkit-key-1');
  fake.authkitKeySet.publish(authkitKey);
  const keySet = createRemoteJWKSet(fake.authkitKeySetUrl, keySetOptions);
  const verify = async (token: string) => {
    const { payload } = await jwtVerify(token, keySet, { issuer: fake.authkitIssuer, audience: mcpResource, algorithms: ['RS256'] });
    return payload;
  };
  return { fake, authkitKey, verify };
}

function connectToken(world: ConnectWorld, key = world.authkitKey, settings: Partial<TokenSettings> = {}): Promise<string> {
  return key.sign(connectUserClaims(), { issuer: world.fake.authkitIssuer, audience: mcpResource, ...settings });
}

describe('Pinned WorkOS SDK and jose contracts against a local fake WorkOS API', () => {
  const realFetch = globalThis.fetch;
  const outboundRequests: string[] = [];

  before(() => {
    globalThis.fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.hostname === '127.0.0.1') return realFetch(input, init);
      outboundRequests.push(url.href);
      throw new Error('Outbound network access is not allowed in the WorkOS proofs');
    };
  });

  after(() => {
    globalThis.fetch = realFetch;
    assert.deepEqual(outboundRequests, [], 'no request left the machine');
  });

  describe('Browser sign-in with AuthKit', () => {
    test('Given the pinned SDK, when the app asks twice for an AuthKit sign-in URL with PKCE, then each URL targets /user_management/authorize with the client ID, the exact redirect URI, response_type=code, provider=authkit, and the S256 challenge of a fresh 43-character verifier with a fresh 43-character state; an organization ID adds organization_id, and no request is sent', async (t) => {
      const fake = await WorkOSFakeApi.start(t);
      const workos = workosClientFor(fake);

      const first = await workos.userManagement.getAuthorizationUrlWithPKCE({ provider: 'authkit', redirectUri });
      const second = await workos.userManagement.getAuthorizationUrlWithPKCE({ provider: 'authkit', redirectUri });
      const forOrganization = await workos.userManagement.getAuthorizationUrlWithPKCE({ provider: 'authkit', redirectUri, organizationId: 'org_01ACME' });

      for (const { url, state, codeVerifier: verifier } of [first, second]) {
        const signInUrl = new URL(url);
        assert.equal(`${signInUrl.origin}${signInUrl.pathname}`, `${fake.origin}/user_management/authorize`);
        assert.ok(url.includes(`&redirect_uri=${encodeURIComponent(redirectUri)}&`), url);
        assert.match(state, /^[\w-]{43}$/);
        assert.match(verifier, /^[\w-]{43}$/);
        assert.deepEqual(Object.fromEntries(signInUrl.searchParams), {
          client_id: fakeClientId,
          code_challenge: createHash('sha256').update(verifier).digest('base64url'),
          code_challenge_method: 'S256',
          provider: 'authkit',
          redirect_uri: redirectUri,
          response_type: 'code',
          state,
        });
      }
      assert.notEqual(first.state, second.state);
      assert.notEqual(first.codeVerifier, second.codeVerifier);
      assert.notEqual(first.state, first.codeVerifier);
      assert.equal(new URL(forOrganization.url).searchParams.get('organization_id'), 'org_01ACME');
      assert.deepEqual(fake.takeRequests(), []);
    });

    test('Given an authorization code, when the app exchanges it with the PKCE verifier and asks for a sealed session, then the SDK posts one JSON authorization_code grant with the client ID, the API key as client_secret, the code, and the verifier, and returns the user, both tokens, and an iron seal (Fe26.2) that hides the tokens and authenticates as that session', async (t) => {
      const world = await browserSessionWorld(t);
      const accessToken = await browserToken(world);
      world.fake.answer(authenticateRoute, authenticationAnswer(accessToken, 'refresh-1'));

      const result = await world.workos.userManagement.authenticateWithCode({ code: 'code-1', codeVerifier, session: { sealSession: true, cookiePassword } });

      assert.deepEqual(world.fake.takeRequests(), [{
        method: 'POST',
        path: '/user_management/authenticate',
        body: { grant_type: 'authorization_code', client_id: fakeClientId, client_secret: fakeApiKey, code: 'code-1', code_verifier: codeVerifier },
        authorization: `Bearer ${fakeApiKey}`,
        idempotencyKey: undefined,
        ifMatch: undefined,
      }]);
      assert.deepEqual(
        { userId: result.user.id, email: result.user.email, accessToken: result.accessToken, refreshToken: result.refreshToken, method: result.authenticationMethod },
        { userId: alice.id, email: alice.email, accessToken, refreshToken: 'refresh-1', method: 'GoogleOAuth' },
      );
      const seal = result.sealedSession ?? '';
      assert.match(seal, /^Fe26\.2\*1\*[^~]+~2$/);
      assert.equal(seal.includes(accessToken) || seal.includes('refresh-1'), false);
      assert.equal(await authenticationOf(world.workos, seal), 'authenticated');
    });

    test('Given a code that WorkOS refuses with 400 invalid_grant, when the app exchanges it, then the SDK throws OauthException with status 400 and error invalid_grant instead of returning a result', async (t) => {
      const world = await browserSessionWorld(t);
      world.fake.answer(authenticateRoute, { status: 400, body: { error: 'invalid_grant', error_description: 'The code is not valid.' } });

      const exchange = world.workos.userManagement.authenticateWithCode({ code: 'code-1', codeVerifier, session: { sealSession: true, cookiePassword } });

      await assert.rejects(exchange, (error: unknown) => {
        assert.ok(error instanceof OauthException, String(error));
        assert.deepEqual({ status: error.status, error: error.error }, { status: 400, error: 'invalid_grant' });
        return true;
      });
      assert.equal(world.fake.takeRequests().length, 1);
    });
  });

  describe('Sealed browser sessions', () => {
    test('Given a sealed session with a valid access token, when a client with the issuer option authenticates it twice, then the SDK reads /sso/jwks/client_test once and returns sid as sessionId, org_id, role, roles, permissions, the sealed user, the authentication method, and the access token', async (t) => {
      const world = await browserSessionWorld(t);
      const accessToken = await browserToken(world);
      const seal = await sealedSession(world, accessToken);

      const session = await authenticatedSession(world.workos, seal);
      const again = await authenticationOf(world.workos, seal);

      const { sessionId, organizationId, role, roles, permissions, user, authenticationMethod } = session;
      assert.deepEqual(
        { sessionId, organizationId, role, roles, permissions, userId: user.id, authenticationMethod, accessToken: session.accessToken },
        {
          sessionId: 'session_01ALICE',
          organizationId: 'org_01ACME',
          role: 'admin',
          roles: ['admin', 'member'],
          permissions: ['members:manage', 'pages:read'],
          userId: alice.id,
          authenticationMethod: 'GoogleOAuth',
          accessToken,
        },
      );
      assert.equal(again, 'authenticated');
      assert.deepEqual(requestLines(world.fake), [`GET /sso/jwks/${fakeClientId}`]);
    });

    test('Given a sealed session, when the cookie password is wrong, one base64url character of the encrypted part changes, a "!" or a "%" replaces one, the value is no seal, or the value is empty, then authenticate returns invalid_session_cookie (no_session_cookie_provided when empty) and reads no key set', async (t) => {
      const world = await browserSessionWorld(t);
      const seal = await sealedSession(world, await browserToken(world));

      const outcomes = {
        wrongPassword: await authenticationOf(world.workos, seal, otherCookiePassword),
        changedCharacter: await authenticationOf(world.workos, sealWithPart(seal, ironSealPart.encrypted, (part) => withCharacterAt10(part, part[10] === 'A' ? 'B' : 'A'))),
        exclamationMark: await authenticationOf(world.workos, sealWithPart(seal, ironSealPart.encrypted, (part) => withCharacterAt10(part, '!'))),
        percentSign: await authenticationOf(world.workos, sealWithPart(seal, ironSealPart.encrypted, (part) => withCharacterAt10(part, '%'))),
        notASeal: await authenticationOf(world.workos, 'not-a-sealed-session'),
        empty: await authenticationOf(world.workos, ''),
      };

      assert.deepEqual(outcomes, {
        wrongPassword: 'invalid_session_cookie',
        changedCharacter: 'invalid_session_cookie',
        exclamationMark: 'invalid_session_cookie',
        percentSign: 'invalid_session_cookie',
        notASeal: 'invalid_session_cookie',
        empty: 'no_session_cookie_provided',
      });
      assert.deepEqual(world.fake.takeRequests(), []);
    });

    test('Given a sealed session, when a "!" replaces a character of the HMAC part, the last 3 characters become "abc" (an HMAC of invalid length), or the expiration part is not a number, then authenticate throws instead of returning a failure: DOMException InvalidCharacterError from atob, or Error "Invalid expiration"', async (t) => {
      const world = await browserSessionWorld(t);
      const seal = await sealedSession(world, await browserToken(world));

      await assert.rejects(authenticationOf(world.workos, sealWithPart(seal, ironSealPart.hmac, (part) => withCharacterAt10(part, '!'))), isInvalidCharacterError);
      await assert.rejects(authenticationOf(world.workos, `${seal.slice(0, -3)}abc`), isInvalidCharacterError);
      await assert.rejects(authenticationOf(world.workos, sealWithPart(seal, ironSealPart.expiration, () => 'not-a-number')), { name: 'Error', message: 'Invalid expiration' });

      assert.deepEqual(world.fake.takeRequests(), []);
    });

    test('Given access tokens that are expired, from another issuer, or signed by another key under the published kid, when a client with the issuer option authenticates their seals, then each gives invalid_jwt, so the SDK does not tell an expired token from a forged one; a client without the issuer option accepts the foreign issuer', async (t) => {
      const world = await browserSessionWorld(t);
      const forger = await SigningKey.generate(world.browserKey.kid);
      const now = nowInSeconds();
      const expired = await sealedSession(world, await browserToken(world, browserClaims(), { issuedAtUnixSeconds: now - 3_600, expiresAtUnixSeconds: now - 60 }));
      const foreignIssuer = await sealedSession(world, await browserToken(world, browserClaims(), { issuer: `${world.fake.origin}/user_management/client_other` }));
      const forged = await sealedSession(world, await forger.sign(browserClaims(), { issuer: world.fake.browserIssuer }));

      const outcomes = {
        expired: await authenticationOf(world.workos, expired),
        foreignIssuer: await authenticationOf(world.workos, foreignIssuer),
        forged: await authenticationOf(world.workos, forged),
      };
      const withoutIssuerCheck = await authenticationOf(workosClientFor(world.fake, { checkIssuer: false }), foreignIssuer);

      assert.deepEqual(outcomes, { expired: 'invalid_jwt', foreignIssuer: 'invalid_jwt', forged: 'invalid_jwt' });
      assert.equal(withoutIssuerCheck, 'authenticated');
    });

    test('Given an access token signed with a kid that the browser key set does not contain, when the client authenticates its seal, then the SDK reads the key set once and throws JWKSNoMatchingKey (code ERR_JWKS_NO_MATCHING_KEY) from its inlined jose copy, which the error classes of the jose package do not match', async (t) => {
      const world = await browserSessionWorld(t);
      const unknownKey = await SigningKey.generate('browser-key-unknown');
      const seal = await sealedSession(world, await unknownKey.sign(browserClaims(), { issuer: world.fake.browserIssuer }));

      await assert.rejects(authenticationOf(world.workos, seal), (error: unknown) => {
        assert.ok(error instanceof Error, String(error));
        assert.deepEqual({ name: error.name, code: (error as { code?: unknown }).code }, { name: 'JWKSNoMatchingKey', code: 'ERR_JWKS_NO_MATCHING_KEY' });
        assert.equal(error instanceof errors.JOSEError, false);
        return true;
      });
      assert.deepEqual(requestLines(world.fake), [`GET /sso/jwks/${fakeClientId}`]);
    });

    test('Given a browser key set that answers 500, never answers, or refuses the connection, when a client without cached keys authenticates a valid seal, then the SDK throws ERR_JOSE_GENERIC, ERR_JWKS_TIMEOUT after the jose default of 5 s, or TypeError "fetch failed" instead of returning a failure result', async (t) => {
      const world = await browserSessionWorld(t);
      const seal = await sealedSession(world, await browserToken(world));
      const refusing = workosClientFor(world.fake, { port: await refusedLoopbackPort() });

      world.fake.browserKeySet.breakWith(internalError);
      await assert.rejects(authenticationOf(workosClientFor(world.fake), seal), {
        code: 'ERR_JOSE_GENERIC',
        message: 'Expected 200 OK from the JSON Web Key Set HTTP response',
      });
      world.fake.browserKeySet.breakWith('hang');
      const started = performance.now();
      await assert.rejects(authenticationOf(workosClientFor(world.fake), seal), { name: 'JWKSTimeout', code: 'ERR_JWKS_TIMEOUT' });
      const waited = performance.now() - started;
      await assert.rejects(authenticationOf(refusing, seal), { name: 'TypeError', message: 'fetch failed' });

      assert.ok(waited >= 4_900 && waited < 10_000, `waited ${waited} ms`);
      assert.deepEqual(requestLines(world.fake), [`GET /sso/jwks/${fakeClientId}`, `GET /sso/jwks/${fakeClientId}`]);
    });

    test('Given a client that read the browser key set, when the key set then never answers or answers 500, then a valid seal still authenticates without a new read until the 10-minute cache age of the SDK ends; then the SDK reads again and throws the key-set error', async (t) => {
      t.mock.timers.enable({ apis: ['Date'], now: Date.now() });
      const world = await browserSessionWorld(t);
      const seal = await sealedSession(world, await browserToken(world));
      assert.equal(await authenticationOf(world.workos, seal), 'authenticated');
      world.fake.takeRequests();

      world.fake.browserKeySet.breakWith('hang');
      const duringHang = await authenticationOf(world.workos, seal);
      world.fake.browserKeySet.breakWith(internalError);
      t.mock.timers.tick(599_999);
      const justBeforeCacheAge = await authenticationOf(world.workos, seal);
      const readsBeforeCacheAge = world.fake.takeRequests().length;
      t.mock.timers.tick(1);
      await assert.rejects(authenticationOf(world.workos, seal), { code: 'ERR_JOSE_GENERIC' });

      assert.deepEqual([duringHang, justBeforeCacheAge, readsBeforeCacheAge], ['authenticated', 'authenticated', 0]);
      assert.deepEqual(requestLines(world.fake), [`GET /sso/jwks/${fakeClientId}`]);
    });

    test('Given a client that read the browser key set, when WorkOS signs with a newly published kid, then authenticate throws ERR_JWKS_NO_MATCHING_KEY without a new read until 5 minutes after the last read (the SDK cooldown), and then reads once and authenticates', async (t) => {
      t.mock.timers.enable({ apis: ['Date'], now: Date.now() });
      const world = await browserSessionWorld(t);
      const nextKey = await SigningKey.generate('browser-key-2');
      assert.equal(await authenticationOf(world.workos, await sealedSession(world, await browserToken(world))), 'authenticated');
      world.fake.takeRequests();
      world.fake.browserKeySet.publish(nextKey);
      const sealWithNextKey = await sealedSession(world, await nextKey.sign(browserClaims(), { issuer: world.fake.browserIssuer }));

      await assert.rejects(authenticationOf(world.workos, sealWithNextKey), { code: 'ERR_JWKS_NO_MATCHING_KEY' });
      t.mock.timers.tick(299_999);
      await assert.rejects(authenticationOf(world.workos, sealWithNextKey), { code: 'ERR_JWKS_NO_MATCHING_KEY' });
      const readsDuringCooldown = world.fake.takeRequests().length;
      t.mock.timers.tick(1);
      const afterCooldown = await authenticationOf(world.workos, sealWithNextKey);

      assert.equal(readsDuringCooldown, 0);
      assert.equal(afterCooldown, 'authenticated');
      assert.deepEqual(requestLines(world.fake), [`GET /sso/jwks/${fakeClientId}`]);
    });
  });

  describe('Session refresh, rotation, organization switching, and logout', () => {
    test('Given a sealed session, when the refresh succeeds, then the SDK posts one refresh_token grant with the stored refresh token and the org_id of the current token and returns a new seal with the claims of the new token; the new seal sends the rotated refresh token, and the old seal still authenticates and sends the old refresh token again, because only WorkOS can refuse a reused refresh token', async (t) => {
      const world = await browserSessionWorld(t);
      const seal = await sealedSession(world, await browserToken(world), 'refresh-1');
      const renewedToken = await browserToken(world, browserClaims({ jti: 'jti_browser_02', role: 'member', roles: ['member'], permissions: ['pages:read'] }));
      world.fake.answer(authenticateRoute, authenticationAnswer(renewedToken, 'refresh-2'));

      const refreshed = await refreshOf(world.workos, seal);
      const firstRefresh = bodiesOf(world.fake);
      if (!refreshed.authenticated) assert.fail(`the refresh failed: ${refreshed.reason}`);
      await refreshOf(world.workos, refreshed.sealedSession ?? '');
      const fromRenewedSeal = refreshTokensSent(world.fake);
      const oldSeal = await authenticationOf(world.workos, seal);
      world.fake.takeRequests();
      await refreshOf(world.workos, seal);
      const fromOldSeal = refreshTokensSent(world.fake);

      assert.deepEqual(firstRefresh, [{
        grant_type: 'refresh_token',
        client_id: fakeClientId,
        client_secret: fakeApiKey,
        refresh_token: 'refresh-1',
        organization_id: 'org_01ACME',
      }]);
      const { sessionId, organizationId, role, roles, permissions, user, sealedSession: renewedSeal } = refreshed;
      assert.deepEqual(
        { sessionId, organizationId, role, roles, permissions, userId: user.id },
        { sessionId: 'session_01ALICE', organizationId: 'org_01ACME', role: 'member', roles: ['member'], permissions: ['pages:read'], userId: alice.id },
      );
      assert.match(renewedSeal ?? '', /^Fe26\.2\*/);
      assert.notEqual(renewedSeal, seal);
      assert.deepEqual(fromRenewedSeal, ['refresh-2']);
      assert.equal(oldSeal, 'authenticated');
      assert.deepEqual(fromOldSeal, ['refresh-1']);
    });

    test('Given a sealed session in one organization, when the app refreshes it with another organization ID, then the SDK sends that organization_id and reports the organization, role, and permissions of the new token, and the new seal authenticates in that organization', async (t) => {
      const world = await browserSessionWorld(t);
      const seal = await sealedSession(world, await browserToken(world));
      const switchedClaims = browserClaims({ org_id: 'org_02GLOBEX', role: 'member', roles: ['member'], permissions: ['pages:read'] });
      world.fake.answer(authenticateRoute, authenticationAnswer(await browserToken(world, switchedClaims), 'refresh-2'));

      const switched = await refreshOf(world.workos, seal, 'org_02GLOBEX');
      const sent = bodiesOf(world.fake);

      if (!switched.authenticated) assert.fail(`the refresh failed: ${switched.reason}`);
      assert.equal((sent[0] as { organization_id?: unknown }).organization_id, 'org_02GLOBEX');
      assert.deepEqual(
        { organizationId: switched.organizationId, role: switched.role, permissions: switched.permissions },
        { organizationId: 'org_02GLOBEX', role: 'member', permissions: ['pages:read'] },
      );
      assert.equal((await authenticatedSession(world.workos, switched.sealedSession ?? '')).organizationId, 'org_02GLOBEX');
    });

    test('Given WorkOS refuses a refresh with 400 invalid_grant, 403 mfa_enrollment, or 403 sso_required as an error or as a code, when the app refreshes with maxRetries 0, then each gives a terminal failure (retryable false) with that reason after exactly one request', async (t) => {
      const world = await browserSessionWorld(t);
      const seal = await sealedSession(world, await browserToken(world));
      const refusals: ReadonlyArray<{ readonly answer: FakeAnswer; readonly reason: string }> = [
        { answer: { status: 400, body: { error: 'invalid_grant', error_description: 'Session has already ended.' } }, reason: 'invalid_grant' },
        { answer: { status: 403, body: { code: 'mfa_enrollment', message: 'The user must enroll in MFA.', pending_authentication_token: 'pending_01', user: alice } }, reason: 'mfa_enrollment' },
        { answer: { status: 403, body: { error: 'sso_required', error_description: 'The user must sign in with SSO.', connection_ids: ['conn_01'], pending_authentication_token: 'pending_02' } }, reason: 'sso_required' },
        { answer: { status: 403, body: { code: 'sso_required', message: 'The user must sign in with SSO.' } }, reason: 'sso_required' },
      ];

      for (const { answer, reason } of refusals) {
        world.fake.answer(authenticateRoute, answer);
        assert.deepEqual(refreshFailure(await refreshOf(world.workos, seal)), { reason, retryable: false, retryAfter: undefined }, reason);
        assert.equal(world.fake.takeRequests().length, 1, reason);
      }
    });

    test('Given a refresh that gets 500, 429 with Retry-After 7 or with an HTTP date, no answer within the client timeout, or a dropped or refused connection, when the app refreshes with maxRetries 0, then each gives a retryable failure (server_error; rate_limit_exceeded with retryAfter 7 or NaN; timeout; network_error) after one attempt', async (t) => {
      const world = await browserSessionWorld(t, { timeoutMs: 200 });
      const seal = await sealedSession(world, await browserToken(world));
      const refusing = workosClientFor(world.fake, { port: await refusedLoopbackPort() });
      const rateLimited = (retryAfter: string): FakeAnswer => ({ status: 429, body: { message: 'Too many requests' }, headers: { 'Retry-After': retryAfter } });
      const failures: ReadonlyArray<{ readonly answer: FakeAnswer; readonly reason: string; readonly retryAfter?: number }> = [
        { answer: internalError, reason: 'server_error' },
        { answer: rateLimited('7'), reason: 'rate_limit_exceeded', retryAfter: 7 },
        { answer: rateLimited('Wed, 21 Oct 2026 07:28:00 GMT'), reason: 'rate_limit_exceeded', retryAfter: Number.NaN },
        { answer: 'hang', reason: 'timeout' },
        { answer: 'close', reason: 'network_error' },
      ];

      for (const { answer, reason, retryAfter } of failures) {
        world.fake.answer(authenticateRoute, answer);
        assert.deepEqual(refreshFailure(await refreshOf(world.workos, seal)), { reason, retryable: true, retryAfter }, reason);
        assert.equal(world.fake.takeRequests().length, 1, reason);
      }
      assert.deepEqual(refreshFailure(await refreshOf(refusing, seal)), { reason: 'network_error', retryable: true, retryAfter: undefined });
    });

    test('Given a refresh that gets 401, 400 invalid_request, or a 502 gateway page that is not JSON, when the app refreshes, then the SDK throws UnauthorizedException, OauthException, or an Error caused by a ParseError instead of returning a failure result', async (t) => {
      const world = await browserSessionWorld(t);
      const seal = await sealedSession(world, await browserToken(world));

      world.fake.answer(authenticateRoute, { status: 401, body: { message: 'Unauthorized' } });
      await assert.rejects(refreshOf(world.workos, seal), UnauthorizedException);
      world.fake.answer(authenticateRoute, { status: 400, body: { error: 'invalid_request', error_description: 'The request is not valid.' } });
      await assert.rejects(refreshOf(world.workos, seal), (error: unknown) => {
        assert.ok(error instanceof OauthException, String(error));
        assert.equal(error.error, 'invalid_request');
        return true;
      });
      world.fake.answer(authenticateRoute, { status: 502, body: '<html><body>502 Bad Gateway</body></html>', headers: { 'content-type': 'text/html' } });
      await assert.rejects(refreshOf(world.workos, seal), (error: unknown) => {
        assert.ok(error instanceof Error && error.cause instanceof Error, String(error));
        assert.deepEqual({ cause: error.cause.name, rawStatus: (error.cause as { rawStatus?: unknown }).rawStatus }, { cause: 'ParseError', rawStatus: 502 });
        return true;
      });

      assert.equal(world.fake.takeRequests().length, 3);
    });

    test('Given the SDK default of 3 retries, when WorkOS answers every refresh attempt with 500 and Retry-After 3600, then the SDK sends 4 requests with one shared generated Idempotency-Key, waits the 60 s cap instead of 3600 s before each retry, and then gives server_error', async (t) => {
      const world = await browserSessionWorld(t, { retries: 'sdk default' });
      const seal = await sealedSession(world, await browserToken(world));
      const longWaits = shortenWaitsOfAMinuteOrMore(t);
      world.fake.answer(authenticateRoute, { ...internalError, headers: { 'Retry-After': '3600' } });

      const outcome = refreshFailure(await refreshOf(world.workos, seal));

      const attempts = world.fake.takeRequests();
      assert.deepEqual(outcome, { reason: 'server_error', retryable: true, retryAfter: undefined });
      assert.equal(attempts.length, 4);
      assert.equal(new Set(attempts.map(({ idempotencyKey }) => idempotencyKey)).size, 1);
      assert.match(attempts[0]?.idempotencyKey ?? '', /^retry-[\da-f-]{36}$/);
      assert.deepEqual(longWaits, [60_000, 60_000, 60_000]);
    });

    test('Given an authenticated seal, when the app asks for the logout URL and revokes the session, then the URL is /user_management/sessions/logout with session_id set to the sid and the encoded return_to, the revocation posts session_id to /user_management/sessions/revoke, and a seal that does not authenticate, also one whose access token has expired, gets an Error instead of a logout URL', async (t) => {
      const world = await browserSessionWorld(t);
      const now = nowInSeconds();
      const expiredSeal = await sealedSession(world, await browserToken(world, browserClaims(), { issuedAtUnixSeconds: now - 3_600, expiresAtUnixSeconds: now - 60 }));
      const seal = await sealedSession(world, await browserToken(world));
      const returnTo = 'https://app.magumagu.example/signed-out?reason=logout';
      world.fake.answer('POST /user_management/sessions/revoke', { status: 200, body: {} });

      const logoutUrl = await world.workos.userManagement.loadSealedSession({ sessionData: seal, cookiePassword }).getLogoutUrl({ returnTo });
      await world.workos.userManagement.revokeSession({ sessionId: 'session_01ALICE' });
      const sent = world.fake.takeRequests().map(({ method, path, body }) => ({ method, path, body }));
      await assert.rejects(
        world.workos.userManagement.loadSealedSession({ sessionData: seal, cookiePassword: otherCookiePassword }).getLogoutUrl({ returnTo }),
        { message: 'Failed to extract session ID for logout URL: invalid_session_cookie' },
      );
      await assert.rejects(
        world.workos.userManagement.loadSealedSession({ sessionData: expiredSeal, cookiePassword }).getLogoutUrl({ returnTo }),
        { message: 'Failed to extract session ID for logout URL: invalid_jwt' },
      );

      assert.equal(logoutUrl, `${world.fake.origin}/user_management/sessions/logout?session_id=session_01ALICE&return_to=${encodeURIComponent(returnTo)}`);
      assert.deepEqual(sent, [
        { method: 'GET', path: `/sso/jwks/${fakeClientId}`, body: undefined },
        { method: 'POST', path: '/user_management/sessions/revoke', body: { session_id: 'session_01ALICE' } },
      ]);
    });
  });

  describe('Organization membership and role reads', () => {
    test('Given a user with several roles in an organization, when the app lists the active memberships of that user in that organization with limit 100, then the SDK sends exactly that query with order=desc, joins two statuses with a comma, and keeps roles and role; a membership that WorkOS sends without roles has no roles field', async (t) => {
      const fake = await WorkOSFakeApi.start(t);
      const workos = workosClientFor(fake);
      const { roles: _roles, ...membershipWithoutRoles } = membershipJson('om_02', ['member']);
      fake.answer(membershipsRoute, {
        status: 200,
        body: { object: 'list', data: [membershipJson('om_01', ['admin', 'member']), membershipWithoutRoles], list_metadata: { before: null, after: null } },
      });

      const active = await workos.userManagement.listOrganizationMemberships({ userId: alice.id, organizationId: 'org_01ACME', statuses: ['active'], limit: 100 });
      await workos.userManagement.listOrganizationMemberships({ userId: alice.id, organizationId: 'org_01ACME', statuses: ['active', 'inactive'], limit: 100 });

      assert.deepEqual(requestLines(fake), [
        `GET /user_management/organization_memberships?user_id=${alice.id}&organization_id=org_01ACME&statuses=active&limit=100&order=desc`,
        `GET /user_management/organization_memberships?user_id=${alice.id}&organization_id=org_01ACME&statuses=active%2Cinactive&limit=100&order=desc`,
      ]);
      const [severalRoles, singleRole] = active.data;
      assert.ok(severalRoles && singleRole);
      assert.deepEqual({ role: severalRoles.role, roles: severalRoles.roles }, { role: { slug: 'admin' }, roles: [{ slug: 'admin' }, { slug: 'member' }] });
      assert.deepEqual(singleRole.role, { slug: 'member' });
      assert.equal('roles' in singleRole, false);
    });

    test('Given three memberships on two pages, when the app pages with limit and the after cursor, then each call reads one page and listMetadata.after is null on the last page; autoPagination returns only the first page when the first call had a limit, and without a limit it reads the first page again with limit 100 and waits at least 350 ms before it follows the cursor', async (t) => {
      const fake = await WorkOSFakeApi.start(t);
      const workos = workosClientFor(fake);
      fake.answer(membershipsRoute, (request) => membershipPage(new URL(request.path, fake.origin).searchParams.get('after')));

      const first = await workos.userManagement.listOrganizationMemberships({ organizationId: 'org_01ACME', limit: 2 });
      const last = await workos.userManagement.listOrganizationMemberships({ organizationId: 'org_01ACME', limit: 2, after: first.listMetadata.after ?? undefined });
      const firstPageOnly = await first.autoPagination();
      const pagedByCursor = requestLines(fake);
      const unlimited = await workos.userManagement.listOrganizationMemberships({ organizationId: 'org_01ACME' });
      const started = performance.now();
      const everything = await unlimited.autoPagination();
      const waited = performance.now() - started;

      const idsOf = (memberships: readonly OrganizationMembership[]) => memberships.map(({ id }) => id);
      assert.deepEqual([idsOf(first.data), first.listMetadata.after], [['om_01', 'om_02'], 'om_02']);
      assert.deepEqual([idsOf(last.data), last.listMetadata.after], [['om_03'], null]);
      assert.deepEqual(idsOf(firstPageOnly), ['om_01', 'om_02']);
      assert.deepEqual(pagedByCursor, [
        'GET /user_management/organization_memberships?organization_id=org_01ACME&limit=2&order=desc',
        'GET /user_management/organization_memberships?organization_id=org_01ACME&limit=2&after=om_02&order=desc',
      ]);
      assert.deepEqual(idsOf(everything), ['om_01', 'om_02', 'om_03']);
      assert.deepEqual(requestLines(fake), [
        'GET /user_management/organization_memberships?organization_id=org_01ACME&order=desc',
        'GET /user_management/organization_memberships?organization_id=org_01ACME&limit=100&order=desc',
        'GET /user_management/organization_memberships?organization_id=org_01ACME&limit=100&after=om_02&order=desc',
      ]);
      assert.ok(waited >= 340, `waited ${waited} ms`);
    });

    test('Given an environment role and an organization role, when the app lists the roles of an organization, then the SDK sends one GET to /authorization/organizations/<id>/roles without paging and returns each slug, permission list, and role type', async (t) => {
      const fake = await WorkOSFakeApi.start(t);
      const workos = workosClientFor(fake);
      fake.answer('GET /authorization/organizations/org_01ACME/roles', {
        status: 200,
        body: { object: 'list', data: [roleJson('admin', ['members:manage', 'pages:read'], 'EnvironmentRole'), roleJson('auditor', ['audit:read'], 'OrganizationRole')] },
      });

      const roles = await workos.authorization.listOrganizationRoles('org_01ACME');

      assert.deepEqual(requestLines(fake), ['GET /authorization/organizations/org_01ACME/roles']);
      assert.deepEqual(roles.data.map(({ slug, permissions, type }) => ({ slug, permissions, type })), [
        { slug: 'admin', permissions: ['members:manage', 'pages:read'], type: 'EnvironmentRole' },
        { slug: 'auditor', permissions: ['audit:read'], type: 'OrganizationRole' },
      ]);
      assert.equal('listMetadata' in roles, false);
    });
  });

  describe('Organization membership writes', () => {
    test('Given maxRetries 0, when the app replaces the role set of a membership, creates a membership with a role set, and deactivates and reactivates a membership, then the SDK sends the complete role_slugs in a PUT, the create fields in a POST, and empty PUT bodies to /deactivate and /reactivate, with no Idempotency-Key, no If-Match, and no version field', async (t) => {
      const fake = await WorkOSFakeApi.start(t);
      const workos = workosClientFor(fake);
      const membership: FakeAnswer = { status: 200, body: membershipJson('om_01', ['member', 'admin']) };
      fake.answer('PUT /user_management/organization_memberships/om_01', membership);
      fake.answer('POST /user_management/organization_memberships', membership);
      fake.answer('PUT /user_management/organization_memberships/om_01/deactivate', membership);
      fake.answer('PUT /user_management/organization_memberships/om_01/reactivate', membership);

      await workos.userManagement.updateOrganizationMembership('om_01', { roleSlugs: ['member', 'admin'] });
      await workos.userManagement.createOrganizationMembership({ organizationId: 'org_01ACME', userId: 'user_02BOB', roleSlugs: ['member'] });
      await workos.userManagement.deactivateOrganizationMembership('om_01');
      await workos.userManagement.reactivateOrganizationMembership('om_01');

      const unconditional = { idempotencyKey: undefined, ifMatch: undefined };
      assert.deepEqual(fake.takeRequests().map(({ method, path, body, idempotencyKey, ifMatch }) => ({ method, path, body, idempotencyKey, ifMatch })), [
        { method: 'PUT', path: '/user_management/organization_memberships/om_01', body: { role_slugs: ['member', 'admin'] }, ...unconditional },
        { method: 'POST', path: '/user_management/organization_memberships', body: { organization_id: 'org_01ACME', user_id: 'user_02BOB', role_slugs: ['member'] }, ...unconditional },
        { method: 'PUT', path: '/user_management/organization_memberships/om_01/deactivate', body: {}, ...unconditional },
        { method: 'PUT', path: '/user_management/organization_memberships/om_01/reactivate', body: {}, ...unconditional },
      ]);
      assert.deepEqual(Object.keys(updateOptionFields), ['roleSlug', 'roleSlugs']);
    });

    test('Given the SDK default of 3 retries, when WorkOS answers 500 with Retry-After 0, then a membership create is sent 4 times with one shared generated Idempotency-Key, and a role-set update is sent 4 times with none, so the SDK protects only the retries of the create with a key', async (t) => {
      const fake = await WorkOSFakeApi.start(t);
      const workos = workosClientFor(fake, { retries: 'sdk default' });
      const failure: FakeAnswer = { ...internalError, headers: { 'Retry-After': '0' } };
      fake.answer('POST /user_management/organization_memberships', failure);
      fake.answer('PUT /user_management/organization_memberships/om_01', failure);

      await assert.rejects(workos.userManagement.createOrganizationMembership({ organizationId: 'org_01ACME', userId: 'user_02BOB', roleSlugs: ['member'] }), GenericServerException);
      const creates = fake.takeRequests();
      await assert.rejects(workos.userManagement.updateOrganizationMembership('om_01', { roleSlugs: ['member', 'admin'] }), GenericServerException);
      const updates = fake.takeRequests();

      assert.equal(creates.length, 4);
      assert.equal(new Set(creates.map(({ idempotencyKey }) => idempotencyKey)).size, 1);
      assert.match(creates[0]?.idempotencyKey ?? '', /^retry-[\da-f-]{36}$/);
      assert.deepEqual(updates.map(({ method, idempotencyKey, ifMatch }) => ({ method, idempotencyKey, ifMatch })), Array(4).fill({ method: 'PUT', idempotencyKey: undefined, ifMatch: undefined }));
    });

    test('Given two administrators who read the same membership, when both replace its role set at the same time, then both calls succeed and the fake keeps only the role set of the last PUT it received, so one grant is lost: the SDK alone cannot make concurrent grant changes safe', async (t) => {
      const fake = await WorkOSFakeApi.start(t);
      const workos = workosClientFor(fake);
      let storedRoles: readonly string[] = ['member'];
      fake.answer('GET /user_management/organization_memberships/om_01', () => ({ status: 200, body: membershipJson('om_01', storedRoles) }));
      fake.answer('PUT /user_management/organization_memberships/om_01', (request) => {
        storedRoles = (request.body as { role_slugs: string[] }).role_slugs;
        return { status: 200, body: membershipJson('om_01', storedRoles) };
      });

      const [readByAlice, readByBob] = await Promise.all([
        workos.userManagement.getOrganizationMembership('om_01'),
        workos.userManagement.getOrganizationMembership('om_01'),
      ]);
      await Promise.all([
        workos.userManagement.updateOrganizationMembership('om_01', { roleSlugs: [...roleSlugsOf(readByAlice), 'admin'] }),
        workos.userManagement.updateOrganizationMembership('om_01', { roleSlugs: [...roleSlugsOf(readByBob), 'billing'] }),
      ]);

      const writes = fake.takeRequests().filter(({ method }) => method === 'PUT');
      assert.equal(writes.length, 2);
      assert.deepEqual(storedRoles, (writes.at(-1)?.body as { role_slugs?: unknown } | undefined)?.role_slugs);
      assert.equal(storedRoles.includes('admin') && storedRoles.includes('billing'), false, `stored roles: ${storedRoles.join(', ')}`);
      assert.deepEqual(writes.map(({ ifMatch }) => ifMatch), [undefined, undefined]);
    });

    test('Given an invitation with one role, when the app sends it, then the SDK posts email, organization_id, inviter_user_id, and role_slug to /user_management/invitations; a role set added at run time is dropped, because an invitation carries one role', async (t) => {
      const fake = await WorkOSFakeApi.start(t);
      const workos = workosClientFor(fake);
      fake.answer('POST /user_management/invitations', {
        status: 201,
        body: { object: 'invitation', id: 'invitation_01', email: 'carol@example.com', state: 'pending', organization_id: 'org_01ACME', inviter_user_id: alice.id, role_slug: 'member' },
      });
      const invitationWithRoleSet = { email: 'carol@example.com', organizationId: 'org_01ACME', inviterUserId: alice.id, roleSlug: 'member', roleSlugs: ['member', 'admin'] };

      await workos.userManagement.sendInvitation(invitationWithRoleSet);

      assert.deepEqual(fake.takeRequests().map(({ method, path, body }) => ({ method, path, body })), [{
        method: 'POST',
        path: '/user_management/invitations',
        body: { email: 'carol@example.com', organization_id: 'org_01ACME', inviter_user_id: alice.id, role_slug: 'member' },
      }]);
      assert.deepEqual(Object.keys(invitationOptionFields), ['email', 'organizationId', 'expiresInDays', 'inviterUserId', 'roleSlug', 'locale']);
    });
  });

  describe('Organization administration: member reads, single-role writes, and invitations', () => {
    test('Given a pending, directory-managed membership with two roles and its user, when the app reads each by ID, then the SDK sends one GET to /user_management/organization_memberships/<id> and one to /user_management/users/<id> and returns id, organizationId, status, updatedAt, directoryManaged, roles, and the email; a 404 entity_not_found answer throws NotFoundException with status 404 and code entity_not_found', async (t) => {
      const fake = await WorkOSFakeApi.start(t);
      const workos = workosClientFor(fake);
      fake.answer('GET /user_management/organization_memberships/om_01', { status: 200, body: { ...membershipJson('om_01', ['user', 'admin']), status: 'pending', directory_managed: true } });
      fake.answer(`GET /user_management/users/${alice.id}`, { status: 200, body: alice });
      fake.answer('GET /user_management/organization_memberships/om_gone', { status: 404, body: { code: 'entity_not_found', message: 'UserOrganizationMembership not found' } });

      const membership = await workos.userManagement.getOrganizationMembership('om_01');
      const user = await workos.userManagement.getUser(alice.id);
      await assert.rejects(workos.userManagement.getOrganizationMembership('om_gone'), (error: unknown) => {
        assert.ok(error instanceof NotFoundException, String(error));
        assert.deepEqual({ status: error.status, code: error.code }, { status: 404, code: 'entity_not_found' });
        return true;
      });

      assert.deepEqual(requestLines(fake), [
        'GET /user_management/organization_memberships/om_01',
        `GET /user_management/users/${alice.id}`,
        'GET /user_management/organization_memberships/om_gone',
      ]);
      const { id, organizationId, status, updatedAt, directoryManaged, roles } = membership;
      assert.deepEqual(
        { id, organizationId, status, updatedAt, directoryManaged, roles },
        { id: 'om_01', organizationId: 'org_01ACME', status: 'pending', updatedAt: '2026-10-13T08:00:00.000Z', directoryManaged: true, roles: [{ slug: 'user' }, { slug: 'admin' }] },
      );
      assert.equal(user.email, alice.email);
    });

    test('Given maxRetries 0, when the app assigns and then removes one role of a membership on the authorization resource of its organization, then the SDK posts and deletes the same JSON body (role_slug, resource_type_slug organization, resource_external_id) at /authorization/organization_memberships/<id>/role_assignments without If-Match or Idempotency-Key, assignRole returns the role assignment, and removeRole reads no answer body and resolves undefined for a 204 without a body and for a 200', async (t) => {
      const fake = await WorkOSFakeApi.start(t);
      const workos = workosClientFor(fake);
      const path = '/authorization/organization_memberships/om_01/role_assignments';
      const change = { organizationMembershipId: 'om_01', roleSlug: 'admin', resourceTypeSlug: 'organization', resourceExternalId: 'org_01ACME' };
      const roleAssignment = {
        object: 'role_assignment',
        id: 'role_assignment_01',
        organization_membership_id: 'om_01',
        role: { slug: 'admin' },
        resource: { id: 'authz_resource_01', external_id: 'org_01ACME', resource_type_slug: 'organization' },
        source: { type: 'direct', group_role_assignment_id: null },
        created_at: '2026-10-14T08:00:00.000Z',
        updated_at: '2026-10-14T08:00:00.000Z',
      };
      fake.answer(`POST ${path}`, { status: 201, body: roleAssignment });
      fake.answer(`DELETE ${path}`, { status: 204 });

      const assignment = await workos.authorization.assignRole(change);
      const removedWith204 = await workos.authorization.removeRole(change);
      fake.answer(`DELETE ${path}`, { status: 200, body: roleAssignment });
      const removedWith200 = await workos.authorization.removeRole(change);

      const sentBody = { role_slug: 'admin', resource_type_slug: 'organization', resource_external_id: 'org_01ACME' };
      const unconditional = { idempotencyKey: undefined, ifMatch: undefined };
      assert.deepEqual(fake.takeRequests().map(({ method, path: sentPath, body, idempotencyKey, ifMatch }) => ({ method, path: sentPath, body, idempotencyKey, ifMatch })), [
        { method: 'POST', path, body: sentBody, ...unconditional },
        { method: 'DELETE', path, body: sentBody, ...unconditional },
        { method: 'DELETE', path, body: sentBody, ...unconditional },
      ]);
      assert.deepEqual(assignment, {
        object: 'role_assignment',
        id: 'role_assignment_01',
        organizationMembershipId: 'om_01',
        role: { slug: 'admin' },
        resource: { id: 'authz_resource_01', externalId: 'org_01ACME', resourceTypeSlug: 'organization' },
        source: { type: 'direct', groupRoleAssignmentId: null },
        createdAt: '2026-10-14T08:00:00.000Z',
        updatedAt: '2026-10-14T08:00:00.000Z',
      });
      assert.deepEqual([removedWith204, removedWith200], [undefined, undefined]);
    });

    test('Given invitations on two pages, when the app lists the invitations of an organization with limit 100, follows the after cursor, and reads one invitation, then the SDK sends organization_id, limit, after, and order=desc and one GET to /user_management/invitations/<id>, and each deserialized invitation keeps token and acceptInvitationUrl, so the directory must drop them', async (t) => {
      const fake = await WorkOSFakeApi.start(t);
      const workos = workosClientFor(fake);
      fake.answer('GET /user_management/invitations', (request) => {
        const lastPage = new URL(request.path, fake.origin).searchParams.get('after') === 'invitation_01';
        const data = [lastPage ? invitationJson('invitation_02', 'revoked') : invitationJson('invitation_01', 'pending')];
        return { status: 200, body: { object: 'list', data, list_metadata: { before: null, after: lastPage ? null : 'invitation_01' } } };
      });
      fake.answer('GET /user_management/invitations/invitation_02', { status: 200, body: invitationJson('invitation_02', 'revoked') });

      const first = await workos.userManagement.listInvitations({ organizationId: 'org_01ACME', limit: 100 });
      const last = await workos.userManagement.listInvitations({ organizationId: 'org_01ACME', limit: 100, after: first.listMetadata.after ?? undefined });
      const one = await workos.userManagement.getInvitation('invitation_02');

      assert.deepEqual(requestLines(fake), [
        'GET /user_management/invitations?organization_id=org_01ACME&limit=100&order=desc',
        'GET /user_management/invitations?organization_id=org_01ACME&limit=100&after=invitation_01&order=desc',
        'GET /user_management/invitations/invitation_02',
      ]);
      assert.equal(last.listMetadata.after, null);
      const read = [...first.data, ...last.data, one].map(({ id, organizationId, email, roleSlug, state, expiresAt, token, acceptInvitationUrl }) => ({ id, organizationId, email, roleSlug, state, expiresAt, token, acceptInvitationUrl }));
      const expected = (id: string, state: string) => ({
        id,
        organizationId: 'org_01ACME',
        email: 'carol@example.com',
        roleSlug: 'user',
        state,
        expiresAt: '2026-10-21T08:00:00.000Z',
        token: `token_${id}`,
        acceptInvitationUrl: `https://authkit.example/invite?invitation_token=token_${id}`,
      });
      assert.deepEqual(read, [expected('invitation_01', 'pending'), expected('invitation_02', 'revoked'), expected('invitation_02', 'revoked')]);
    });

    test('Given an invitation of one role without an inviter, when the app sends it, then the SDK posts exactly email, organization_id, and role_slug to /user_management/invitations; the 400 refusals email_already_invited_to_organization, user_already_organization_member, and invalid_role, whose body has a code and a message but no errors list, each throw GenericServerException with status 400 and that code, not BadRequestException', async (t) => {
      const fake = await WorkOSFakeApi.start(t);
      const workos = workosClientFor(fake);
      const invitation = { email: 'carol@example.com', organizationId: 'org_01ACME', roleSlug: 'user' };
      const refusals = [
        { code: 'email_already_invited_to_organization', message: 'Email already invited to organization.' },
        { code: 'user_already_organization_member', message: 'User already a member of organization.' },
        { code: 'invalid_role', message: 'The role is invalid.' },
      ];
      fake.answer('POST /user_management/invitations', { status: 201, body: invitationJson('invitation_01', 'pending') });

      const sent = await workos.userManagement.sendInvitation(invitation);
      const firstSend = fake.takeRequests().map(({ method, path, body }) => ({ method, path, body }));
      for (const refusal of refusals) {
        fake.answer('POST /user_management/invitations', { status: 400, body: refusal });
        await assert.rejects(workos.userManagement.sendInvitation(invitation), (error: unknown) => {
          assert.ok(error instanceof GenericServerException, String(error));
          assert.deepEqual({ status: error.status, code: error.code, badRequest: error instanceof BadRequestException }, { status: 400, code: refusal.code, badRequest: false });
          return true;
        });
      }

      assert.deepEqual(firstSend, [{
        method: 'POST',
        path: '/user_management/invitations',
        body: { email: 'carol@example.com', organization_id: 'org_01ACME', role_slug: 'user' },
      }]);
      assert.deepEqual({ id: sent.id, state: sent.state }, { id: 'invitation_01', state: 'pending' });
      assert.equal(fake.takeRequests().length, refusals.length);
    });

    test('Given a pending invitation, when the app resends it and then revokes it, then the SDK posts {} to /user_management/invitations/<id>/resend and an empty body to /revoke and returns each answer; a 400 invite_not_pending answer to a revoke throws GenericServerException with status 400 and code invite_not_pending', async (t) => {
      const fake = await WorkOSFakeApi.start(t);
      const workos = workosClientFor(fake);
      fake.answer('POST /user_management/invitations/invitation_01/resend', { status: 200, body: invitationJson('invitation_01', 'pending') });
      fake.answer('POST /user_management/invitations/invitation_01/revoke', { status: 200, body: invitationJson('invitation_01', 'revoked') });

      const resent = await workos.userManagement.resendInvitation('invitation_01');
      const revoked = await workos.userManagement.revokeInvitation('invitation_01');
      const sent = fake.takeRequests().map(({ method, path, body }) => ({ method, path, body }));
      fake.answer('POST /user_management/invitations/invitation_01/revoke', { status: 400, body: { code: 'invite_not_pending', message: 'Invite is not pending.' } });
      await assert.rejects(workos.userManagement.revokeInvitation('invitation_01'), (error: unknown) => {
        assert.ok(error instanceof GenericServerException, String(error));
        assert.deepEqual({ status: error.status, code: error.code }, { status: 400, code: 'invite_not_pending' });
        return true;
      });

      assert.deepEqual(sent, [
        { method: 'POST', path: '/user_management/invitations/invitation_01/resend', body: {} },
        { method: 'POST', path: '/user_management/invitations/invitation_01/revoke', body: undefined },
      ]);
      assert.deepEqual([resent.state, revoked.state], ['pending', 'revoked']);
    });
  });

  describe('Connect access tokens and key rotation', () => {
    test('Given a Connect access token from the AuthKit issuer for the MCP resource with user claims, when jose verifies it against the AuthKit key set with RS256 only, then it returns the claims; another issuer, another audience, an expired token, another key under the published kid, and an HS256 token are rejected with their jose codes', async (t) => {
      const world = await connectWorld(t);
      const now = nowInSeconds();
      const forger = await SigningKey.generate(world.authkitKey.kid);
      const hs256Token = await new SignJWT(connectUserClaims())
        .setProtectedHeader({ alg: 'HS256', kid: world.authkitKey.kid })
        .setIssuer(world.fake.authkitIssuer)
        .setAudience(mcpResource)
        .setIssuedAt(now)
        .setExpirationTime(now + 3_600)
        .sign(new TextEncoder().encode('a-shared-secret-that-an-attacker-chose-0123'));

      const payload = await world.verify(await connectToken(world));

      assert.deepEqual(payload, { ...connectUserClaims(), iss: world.fake.authkitIssuer, aud: mcpResource, iat: payload.iat, exp: payload.exp });
      await assert.rejects(world.verify(await connectToken(world, world.authkitKey, { issuer: 'https://other-tenant.authkit.app' })), { code: 'ERR_JWT_CLAIM_VALIDATION_FAILED', claim: 'iss' });
      await assert.rejects(world.verify(await connectToken(world, world.authkitKey, { audience: 'https://other.example/mcp' })), { code: 'ERR_JWT_CLAIM_VALIDATION_FAILED', claim: 'aud' });
      await assert.rejects(world.verify(await connectToken(world, world.authkitKey, { issuedAtUnixSeconds: now - 3_600, expiresAtUnixSeconds: now - 60 })), { code: 'ERR_JWT_EXPIRED', claim: 'exp' });
      await assert.rejects(world.verify(await connectToken(world, forger)), { code: 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED' });
      await assert.rejects(world.verify(hs256Token), { code: 'ERR_JOSE_ALG_NOT_ALLOWED' });
    });

    test('Given an M2M-shaped token without sid whose sub equals its client_id, with the right issuer and audience, when jose verifies it, then jose accepts it, so the MCP verifier must reject it by its own rule', async (t) => {
      const world = await connectWorld(t);
      const machineClaims = { sub: 'client_01M2M', client_id: 'client_01M2M', org_id: 'org_01ACME', scope: 'mcp:read', jti: 'jti_m2m_01' };

      const payload = await world.verify(await world.authkitKey.sign(machineClaims, { issuer: world.fake.authkitIssuer, audience: mcpResource }));

      assert.equal(payload.sid, undefined);
      assert.equal(payload.sub, payload.client_id);
    });

    test('Given an AuthKit key set read with a 100 ms cooldown, when WorkOS publishes a new kid, then a token with that kid fails with ERR_JWKS_NO_MATCHING_KEY and no read during the cooldown, and after the cooldown jose reads the key set once and accepts the token', async (t) => {
      const world = await connectWorld(t, { cooldownDuration: 100, cacheMaxAge: 60_000 });
      const nextKey = await SigningKey.generate('authkit-key-2');
      const tokenWithNextKey = await connectToken(world, nextKey);
      await world.verify(await connectToken(world));
      world.fake.takeRequests();

      world.fake.authkitKeySet.publish(nextKey);
      await assert.rejects(world.verify(tokenWithNextKey), { code: 'ERR_JWKS_NO_MATCHING_KEY' });
      const readsDuringCooldown = world.fake.takeRequests().length;
      await delay(150);
      const payload = await world.verify(tokenWithNextKey);

      assert.equal(readsDuringCooldown, 0);
      assert.equal(payload.sub, alice.id);
      assert.deepEqual(requestLines(world.fake), ['GET /authkit/oauth2/jwks']);
    });

    test('Given an AuthKit key set read with a 300 ms cache age, when WorkOS withdraws a key, then tokens signed with it verify from the cache until the cache age passes; then jose reads the key set again and rejects them with ERR_JWKS_NO_MATCHING_KEY while the next key verifies', async (t) => {
      const world = await connectWorld(t, { cooldownDuration: 100, cacheMaxAge: 300 });
      const nextKey = await SigningKey.generate('authkit-key-2');
      world.fake.authkitKeySet.publish(nextKey);
      const tokenWithOldKey = await connectToken(world);
      const tokenWithNextKey = await connectToken(world, nextKey);
      await world.verify(tokenWithOldKey);
      world.fake.takeRequests();

      world.fake.authkitKeySet.withdraw(world.authkitKey);
      const fromCache = await world.verify(tokenWithOldKey);
      const readsWithinCacheAge = world.fake.takeRequests().length;
      await delay(350);
      await assert.rejects(world.verify(tokenWithOldKey), { code: 'ERR_JWKS_NO_MATCHING_KEY' });
      const withNextKey = await world.verify(tokenWithNextKey);

      assert.equal(fromCache.sub, alice.id);
      assert.equal(readsWithinCacheAge, 0);
      assert.equal(withNextKey.sub, alice.id);
      assert.deepEqual(requestLines(world.fake), ['GET /authkit/oauth2/jwks']);
    });

    test('Given an AuthKit key set outage (500 or no answer), when jose verifies a token with fresh cached keys, then the result does not change and nothing is read; after the cache age, without cached keys, or with a refused connection, jose throws a key-set error (ERR_JOSE_GENERIC, ERR_JWKS_TIMEOUT after the 100 ms timeout, or TypeError) and not a token rejection', async (t) => {
      const keySetOptions = { cooldownDuration: 100, cacheMaxAge: 300, timeoutDuration: 100 };
      const world = await connectWorld(t, keySetOptions);
      const token = await connectToken(world);
      const keySetWithoutCache = createRemoteJWKSet(world.fake.authkitKeySetUrl, keySetOptions);
      const refusedKeySet = createRemoteJWKSet(new URL(`http://127.0.0.1:${await refusedLoopbackPort()}/authkit/oauth2/jwks`), keySetOptions);
      const verifyWith = (keySet: ReturnType<typeof createRemoteJWKSet>) => jwtVerify(token, keySet, { issuer: world.fake.authkitIssuer, audience: mcpResource, algorithms: ['RS256'] });
      await world.verify(token);
      world.fake.takeRequests();

      world.fake.authkitKeySet.breakWith(internalError);
      const during500 = await world.verify(token);
      world.fake.authkitKeySet.breakWith('hang');
      const duringHang = await world.verify(token);
      const readsWithFreshKeys = world.fake.takeRequests().length;
      await delay(350);

      assert.deepEqual([during500.sub, duringHang.sub, readsWithFreshKeys], [alice.id, alice.id, 0]);
      await assert.rejects(world.verify(token), { code: 'ERR_JWKS_TIMEOUT' });
      world.fake.authkitKeySet.breakWith(internalError);
      await assert.rejects(world.verify(token), { code: 'ERR_JOSE_GENERIC', message: 'Expected 200 OK from the JSON Web Key Set HTTP response' });
      await assert.rejects(verifyWith(keySetWithoutCache), { code: 'ERR_JOSE_GENERIC' });
      world.fake.authkitKeySet.breakWith('hang');
      await assert.rejects(verifyWith(keySetWithoutCache), { code: 'ERR_JWKS_TIMEOUT' });
      await assert.rejects(verifyWith(refusedKeySet), { name: 'TypeError', message: 'fetch failed' });
    });

    test('Given jose defaults, when the clock moves, then a read AuthKit key set refuses a new kid without a new read for 30 s, reads it at 30 s, and keeps a withdrawn key for 10 min after that read', async (t) => {
      t.mock.timers.enable({ apis: ['Date'], now: Date.now() });
      const world = await connectWorld(t);
      const nextKey = await SigningKey.generate('authkit-key-2');
      const tokenWithNextKey = await connectToken(world, nextKey);
      const tokenWithOldKey = await connectToken(world);
      await world.verify(tokenWithOldKey);
      world.fake.takeRequests();

      world.fake.authkitKeySet.publish(nextKey);
      t.mock.timers.tick(29_999);
      await assert.rejects(world.verify(tokenWithNextKey), { code: 'ERR_JWKS_NO_MATCHING_KEY' });
      const readsDuringCooldown = world.fake.takeRequests().length;
      t.mock.timers.tick(1);
      await world.verify(tokenWithNextKey);
      const readsAtCooldownEnd = requestLines(world.fake);
      world.fake.authkitKeySet.withdraw(world.authkitKey);
      t.mock.timers.tick(599_999);
      await world.verify(tokenWithOldKey);
      const readsWithinCacheAge = world.fake.takeRequests().length;
      t.mock.timers.tick(1);

      assert.deepEqual([readsDuringCooldown, readsAtCooldownEnd, readsWithinCacheAge], [0, ['GET /authkit/oauth2/jwks'], 0]);
      await assert.rejects(world.verify(tokenWithOldKey), { code: 'ERR_JWKS_NO_MATCHING_KEY' });
      assert.deepEqual(requestLines(world.fake), ['GET /authkit/oauth2/jwks']);
    });
  });
});
