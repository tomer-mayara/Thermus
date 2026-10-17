import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import { describe, test, type TestContext } from 'node:test';
import { createLocalJWKSet, createRemoteJWKSet, SignJWT, UnsecuredJWT, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import { InvalidAccessTokenError } from '../../../src/auth/identity-verifier.ts';
import { WorkOSAuthProvider } from '../../../src/auth/hosted-auth/workos/workos-auth-provider.ts';
import { browserSessionIssuer, workosAuthority } from '../../../src/auth/hosted-auth/workos/workos-settings.ts';
import { nowInSeconds, SigningKey, type TokenSettings } from '../../support/doubles/workos/jwt-signing-key.ts';
import { refusedLoopbackPort, WorkOSFakeApi, type FakeAnswer } from '../../support/doubles/workos/workos-fake-api.ts';

const environmentClientId = 'client_01ENVIRONMENT';
const authority = workosAuthority(environmentClientId);
const authkitIssuer = 'https://reasonable-field-33-staging.authkit.app';
const mcpResourceUrl = 'https://localhost:46443/mcp';
const mcpClientId = 'client_01MCPAPP';
const alice = 'user_01ALICE';
const acme = 'org_01ACME';

const authkitKey = await SigningKey.generate('authkit-key-1');
const forgerUnderPublishedKid = await SigningKey.generate(authkitKey.kid);
const unpublishedKey = await SigningKey.generate('unpublished-key');

// The claims of a live Connect user token: no roles or permissions, and the consent in sid.
function connectClaims(changes: JWTPayload = {}): JWTPayload {
  return {
    sub: alice,
    client_id: mcpClientId,
    sid: 'app_consent_01ALICE',
    org_id: acme,
    scope: 'email offline_access openid profile',
    auth_time: nowInSeconds() - 30,
    jti: 'jti_connect_01',
    ...changes,
  };
}

function connectToken(claims = connectClaims(), settings: Partial<TokenSettings> = {}, key = authkitKey): Promise<string> {
  const issuedAt = nowInSeconds();
  return key.sign(claims, { issuer: authkitIssuer, audience: mcpResourceUrl, issuedAtUnixSeconds: issuedAt, expiresAtUnixSeconds: issuedAt + 300, ...settings });
}

const noGrantRead = { activeGrants: async () => assert.fail('verification reads no grant') };

function providerWith(keySet: JWTVerifyGetKey = createLocalJWKSet({ keys: [authkitKey.publicJwk] })): WorkOSAuthProvider {
  return new WorkOSAuthProvider({ authority, authkitIssuer, mcpResourceUrl, keySet, grants: noGrantRead });
}

async function assertInvalidToken(verification: Promise<unknown>, token: string): Promise<void> {
  await assert.rejects(verification, (error) => {
    assert.ok(error instanceof InvalidAccessTokenError, inspect(error));
    assert.ok(token === '' || !error.message.includes(token), 'the error message holds the token');
    return true;
  });
}

async function assertKeySetFailure(verification: Promise<unknown>, expected: Readonly<Record<string, string>>): Promise<void> {
  await assert.rejects(verification, (error) => {
    assert.ok(error instanceof Error && !(error instanceof InvalidAccessTokenError), `a key-set failure became a token rejection: ${inspect(error)}`);
    for (const [property, value] of Object.entries(expected)) assert.equal(Reflect.get(error, property), value);
    return true;
  });
}

function hs256Token(): Promise<string> {
  const now = nowInSeconds();
  return new SignJWT(connectClaims())
    .setProtectedHeader({ alg: 'HS256', kid: authkitKey.kid })
    .setIssuer(authkitIssuer)
    .setAudience(mcpResourceUrl)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(new TextEncoder().encode('a-shared-secret-that-an-attacker-chose-0123'));
}

function unsignedToken(): string {
  const now = nowInSeconds();
  return new UnsecuredJWT(connectClaims()).setIssuer(authkitIssuer).setAudience(mcpResourceUrl).setIssuedAt(now).setExpirationTime(now + 300).encode();
}

// Only the outage that never answers needs a short timeout. A busy test run can make the first answer of the fake
// slower than that, so each other case keeps the jose default.
async function remoteKeySetWorld(t: TestContext, timeoutDuration?: number) {
  const fake = await WorkOSFakeApi.start(t);
  fake.authkitKeySet.publish(authkitKey);
  const provider = providerWith(createRemoteJWKSet(fake.authkitKeySetUrl, timeoutDuration === undefined ? {} : { timeoutDuration }));
  return { fake, provider };
}

describe('WorkOSAuthProvider Connect token verification', () => {
  test('Given a Connect user token from the AuthKit issuer for the MCP resource, when it is verified, then the identity has the user in the WorkOS authority with the organization of the token, the actual issuer and client, the scopes, the time claims, and the MCP resource', async () => {
    const issuedAt = nowInSeconds();
    const token = await connectToken(connectClaims(), { issuedAtUnixSeconds: issuedAt, expiresAtUnixSeconds: issuedAt + 300 });

    const identity = await providerWith().verifyAccessToken(token);

    assert.deepEqual(identity, {
      user: { authority, subject: alice, selectedOrganizationId: acme },
      issuer: authkitIssuer,
      clientId: mcpClientId,
      scopes: ['email', 'offline_access', 'openid', 'profile'],
      issuedAtUnixSeconds: issuedAt,
      expiresAtUnixSeconds: issuedAt + 300,
      resource: new URL(mcpResourceUrl),
    });
  });

  test('Given a Connect user token without org_id, when it is verified, then the user has no selected organization', async () => {
    const identity = await providerWith().verifyAccessToken(await connectToken(connectClaims({ org_id: undefined })));

    assert.deepEqual(identity.user, { authority, subject: alice });
    assert.equal('selectedOrganizationId' in identity.user, false);
  });

  for (const { label, scope, scopes } of [
    { label: 'extra spaces', scope: ' openid  profile ', scopes: ['openid', 'profile'] },
    { label: 'no value', scope: '', scopes: [] },
  ]) {
    test(`Given a Connect user token whose scope has ${label}, when it is verified, then the identity has only the named scopes and no scope is required`, async () => {
      const identity = await providerWith().verifyAccessToken(await connectToken(connectClaims({ scope })));

      assert.deepEqual(identity.scopes, scopes);
    });
  }

  test('Given tokens of the same user from two MCP clients, when they are verified, then both users have the one WorkOS authority and each identity keeps its own client ID', async () => {
    const provider = providerWith();

    const first = await provider.verifyAccessToken(await connectToken());
    const second = await provider.verifyAccessToken(await connectToken(connectClaims({ client_id: 'client_02OTHERAPP' })));

    assert.deepEqual([first.user, second.user], [{ authority, subject: alice, selectedOrganizationId: acme }, { authority, subject: alice, selectedOrganizationId: acme }]);
    assert.deepEqual([first.clientId, second.clientId], [mcpClientId, 'client_02OTHERAPP']);
  });

  test('Given tokens that expired 30 s ago or were issued 30 s in the future, when they are verified, then the clock tolerance of 60 s accepts them', async () => {
    const now = nowInSeconds();
    const provider = providerWith();

    await provider.verifyAccessToken(await connectToken(connectClaims(), { issuedAtUnixSeconds: now - 330, expiresAtUnixSeconds: now - 30 }));
    await provider.verifyAccessToken(await connectToken(connectClaims(), { issuedAtUnixSeconds: now + 30, expiresAtUnixSeconds: now + 330 }));
  });

  for (const { label, token } of [
    { label: 'another issuer', token: () => connectToken(connectClaims(), { issuer: 'https://other-tenant.authkit.app' }) },
    { label: 'the issuer with a final slash', token: () => connectToken(connectClaims(), { issuer: `${authkitIssuer}/` }) },
    { label: 'another audience', token: () => connectToken(connectClaims(), { audience: 'https://other.example/mcp' }) },
    { label: 'the environment client as its audience', token: () => connectToken(connectClaims(), { audience: environmentClientId }) },
    {
      label: 'the shape of a browser session token with the same key (browser issuer, no audience)',
      token: () => connectToken(
        { sub: alice, sid: 'session_01ALICE', org_id: acme, role: 'user', roles: ['user'], permissions: ['product:access'], jti: 'jti_browser_01' },
        { issuer: browserSessionIssuer(environmentClientId), audience: undefined },
      ),
    },
    {
      label: 'the shape of an M2M token for the MCP resource (no sid, sub equal to client_id)',
      token: () => connectToken({ sub: 'client_01M2M', client_id: 'client_01M2M', org_id: acme, scope: 'openid', jti: 'jti_m2m_01' }),
    },
    { label: 'no sid', token: () => connectToken(connectClaims({ sid: undefined })) },
    { label: 'a sub equal to its client_id', token: () => connectToken(connectClaims({ sub: mcpClientId })) },
    { label: 'no client_id', token: () => connectToken(connectClaims({ client_id: undefined })) },
    { label: 'no scope', token: () => connectToken(connectClaims({ scope: undefined })) },
    { label: 'no sub', token: () => connectToken(connectClaims({ sub: undefined })) },
    { label: 'an empty sid', token: () => connectToken(connectClaims({ sid: '' })) },
    { label: 'an empty client_id', token: () => connectToken(connectClaims({ client_id: '' })) },
    { label: 'an empty sub', token: () => connectToken(connectClaims({ sub: '' })) },
    { label: 'a scope list', token: () => connectToken(connectClaims({ scope: ['openid'] })) },
    { label: 'an empty org_id', token: () => connectToken(connectClaims({ org_id: '' })) },
    { label: 'a numeric org_id', token: () => connectToken(connectClaims({ org_id: 42 })) },
    { label: 'a null org_id', token: () => connectToken(connectClaims({ org_id: null })) },
    { label: 'an expiry 61 s ago', token: () => connectToken(connectClaims(), { issuedAtUnixSeconds: nowInSeconds() - 361, expiresAtUnixSeconds: nowInSeconds() - 61 }) },
    { label: 'an issue time 120 s in the future', token: () => connectToken(connectClaims(), { issuedAtUnixSeconds: nowInSeconds() + 120, expiresAtUnixSeconds: nowInSeconds() + 420 }) },
    { label: 'HS256 with the published kid', token: hs256Token },
    { label: 'the algorithm none', token: async () => unsignedToken() },
    { label: 'another key under the published kid', token: () => connectToken(connectClaims(), {}, forgerUnderPublishedKid) },
    { label: 'a kid that the key set does not have', token: () => connectToken(connectClaims(), {}, unpublishedKey) },
    { label: 'a header that is not JSON', token: async () => 'abc.def.ghi' },
    { label: 'one segment', token: async () => 'not-a-token' },
    { label: 'an empty value', token: async () => '' },
  ]) {
    test(`Given a token with ${label}, when it is verified, then it is refused as an invalid token`, async () => {
      const refused = await token();

      await assertInvalidToken(providerWith().verifyAccessToken(refused), refused);
    });
  }

  test('Given an expired token with a private claim, when verification refuses it, then inspection of the error shows neither the token nor the private claim', async () => {
    const privateClaim = 'private-claim-value-for-this-token';
    const token = await connectToken(connectClaims({ privateData: privateClaim }), { issuedAtUnixSeconds: nowInSeconds() - 600, expiresAtUnixSeconds: nowInSeconds() - 300 });

    await assert.rejects(providerWith().verifyAccessToken(token), (error: unknown) => {
      assert.ok(error instanceof InvalidAccessTokenError);
      const report = inspect(error, { depth: Infinity });
      assert.ok(!report.includes(token), 'the error holds the token');
      assert.ok(!report.includes(privateClaim), 'the error holds the private claim');
      return true;
    });
  });

  test('Given the AuthKit key set of the WorkOS API, when a valid token is verified two times, then the key set is read one time', async (t) => {
    const { fake, provider } = await remoteKeySetWorld(t);
    const token = await connectToken();

    await provider.verifyAccessToken(token);
    await provider.verifyAccessToken(token);

    assert.deepEqual(fake.takeRequests().map(({ method, path }) => `${method} ${path}`), ['GET /authkit/oauth2/jwks']);
  });

  for (const { label, outage, expected } of [
    { label: 'answers HTTP 500', outage: { status: 500, body: { message: 'Internal error' } }, expected: { code: 'ERR_JOSE_GENERIC' } },
    { label: 'does not answer within the timeout', outage: 'hang', expected: { code: 'ERR_JWKS_TIMEOUT' } },
    { label: 'answers a body that is not a key set', outage: { status: 200, body: { keys: 'none' } }, expected: { code: 'ERR_JWKS_INVALID' } },
  ] satisfies { label: string; outage: FakeAnswer; expected: { code: string } }[]) {
    test(`Given an AuthKit key set that ${label}, when a valid token is verified, then the key-set failure is thrown as an unexpected error and not as a token rejection`, async (t) => {
      const { fake, provider } = await remoteKeySetWorld(t, outage === 'hang' ? 100 : undefined);
      fake.authkitKeySet.breakWith(outage);

      await assertKeySetFailure(provider.verifyAccessToken(await connectToken()), expected);
    });
  }

  test('Given an AuthKit key set on a port that refuses the connection, when a valid token is verified, then the fetch failure is thrown as an unexpected error and not as a token rejection', async () => {
    const refusedKeySet = createRemoteJWKSet(new URL(`http://127.0.0.1:${await refusedLoopbackPort()}/authkit/oauth2/jwks`), { timeoutDuration: 100 });

    await assertKeySetFailure(providerWith(refusedKeySet).verifyAccessToken(await connectToken()), { name: 'TypeError' });
  });
});
