import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import { describe, test } from 'node:test';
import { BetterAuthProvider } from '../../../src/auth-better-auth/better-auth-provider.ts';
import { InvalidAccessTokenError } from '../../../src/mcp/identity-verifier.ts';
import {
  AccessTokenSigner,
  localIssuer,
  localUserClaims,
  mcpResourceUrl,
  withChangedClaims,
  type TokenFields,
} from './fixtures/local-access-tokens.ts';
import { installationId, localSettings, TokenProviderDouble } from './fixtures/token-provider-double.ts';

function verifierWithOwnKey() {
  const signer = new AccessTokenSigner('local-key-1');
  const provider = new TokenProviderDouble(signer.publicKey);
  return { signer, provider, verifier: new BetterAuthProvider(provider.auth, localSettings) };
}

async function assertInvalidToken(verification: Promise<unknown>, token: string): Promise<void> {
  await assert.rejects(verification, (error) => {
    assert.ok(error instanceof InvalidAccessTokenError, inspect(error));
    assert.ok(!error.message.includes(token), 'the error message holds the token');
    return true;
  });
}

function nowInSeconds(): number {
  return Math.floor(Date.now() / 1_000);
}

// A header that decodes, so only the structural check keeps these values from the provider.
const header = Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'at+jwt', kid: 'local-key-1' })).toString('base64url');

describe('BetterAuthProvider token verification', () => {
  test('Given a valid token of a local user that introspection reports active, when it is verified, then the identity has the user in the installation authority, the actual issuer and client, the scopes, the time claims, and the MCP resource', async () => {
    const { signer, verifier } = verifierWithOwnKey();
    const claims = localUserClaims();

    const identity = await verifier.verifyAccessToken(signer.sign(claims));

    assert.deepEqual(identity, {
      user: { authority: `better-auth:${installationId}`, subject: 'user-1' },
      issuer: localIssuer,
      clientId: 'native-client',
      scopes: ['openid', 'profile'],
      issuedAtUnixSeconds: claims.iat,
      expiresAtUnixSeconds: claims.exp,
      resource: new URL(mcpResourceUrl),
    });
  });

  for (const { label, scope, scopes } of [
    { label: 'extra spaces', scope: ' openid  profile ', scopes: ['openid', 'profile'] },
    { label: 'no value', scope: '', scopes: [] },
  ]) {
    test(`Given a valid token whose scope has ${label}, when it is verified, then the identity has only the named scopes`, async () => {
      const { signer, verifier } = verifierWithOwnKey();

      const identity = await verifier.verifyAccessToken(signer.sign(localUserClaims({ scope })));

      assert.deepEqual(identity.scopes, scopes);
    });
  }

  for (const { label, token } of [
    { label: 'a changed payload', token: (signer: AccessTokenSigner) => withChangedClaims(signer.sign(localUserClaims()), { sub: 'user-2' }) },
    { label: 'the key of another installation', token: () => new AccessTokenSigner('foreign-key').sign(localUserClaims()) },
    { label: 'an ID token', token: (signer: AccessTokenSigner) => signer.sign(localUserClaims(), { typ: 'JWT' }) },
    { label: 'the algorithm none', token: (signer: AccessTokenSigner) => signer.sign(localUserClaims(), { alg: 'none' }) },
    { label: 'another issuer', token: (signer: AccessTokenSigner) => signer.sign(localUserClaims({ iss: 'http://localhost:9090/api/auth' })) },
    { label: 'an audience without the MCP resource', token: (signer: AccessTokenSigner) => signer.sign(localUserClaims({ aud: [`${localIssuer}/oauth2/userinfo`] })) },
    { label: 'an expired token', token: (signer: AccessTokenSigner) => signer.sign(localUserClaims({ iat: nowInSeconds() - 3_700, exp: nowInSeconds() - 100 })) },
    { label: 'a header that is not JSON', token: () => 'abc.def.ghi' },
  ]) {
    test(`Given ${label}, when it is verified, then it is refused as an invalid token and the provider gets no introspection request`, async () => {
      const { signer, provider, verifier } = verifierWithOwnKey();
      const refused = token(signer);

      await assertInvalidToken(verifier.verifyAccessToken(refused), refused);

      assert.deepEqual(provider.requests, []);
    });
  }

  test('Given a token signed with ES256 by a key in the provider key set, when it is verified, then it is refused as an invalid token, because only EdDSA is allowed, and the provider gets no introspection request', async () => {
    const signer = new AccessTokenSigner('ec-key', 'ES256');
    const provider = new TokenProviderDouble(signer.publicKey);
    const refused = signer.sign(localUserClaims());

    await assertInvalidToken(new BetterAuthProvider(provider.auth, localSettings).verifyAccessToken(refused), refused);

    assert.deepEqual(provider.requests, []);
  });

  for (const { label, token } of [
    { label: 'an empty value', token: '' },
    { label: 'one segment', token: 'not-a-token' },
    { label: 'two segments', token: 'abc.def' },
    { label: 'five segments', token: `${header}.e30.c2ln.aXY.dGFn` },
    { label: 'an empty signature', token: `${header}.e30.` },
    { label: 'a character outside base64url', token: `${header}.e3+0.c2ln` },
    { label: 'base64 padding', token: `${header}.e30.c2ln=` },
    { label: 'a space', token: `${header}.e30 .c2ln` },
  ]) {
    test(`Given ${label}, when it is verified, then it is refused as an invalid token without a provider call`, async () => {
      const { provider, verifier } = verifierWithOwnKey();

      await assert.rejects(verifier.verifyAccessToken(token), InvalidAccessTokenError);

      assert.deepEqual(provider.calls, []);
    });
  }

  for (const { claim, changes } of [
    { claim: 'sid', changes: { sid: undefined } },
    { claim: 'sub', changes: { sub: undefined } },
    { claim: 'client_id or azp', changes: { client_id: undefined, azp: undefined } },
    { claim: 'scope', changes: { scope: undefined } },
    { claim: 'iat', changes: { iat: undefined } },
    { claim: 'exp', changes: { exp: undefined } },
  ] satisfies { claim: string; changes: TokenFields }[]) {
    test(`Given a signed token without ${claim}, when it is verified, then it is refused as an invalid token and the provider gets no introspection request`, async () => {
      const { signer, provider, verifier } = verifierWithOwnKey();
      const refused = signer.sign(localUserClaims(changes));

      await assertInvalidToken(verifier.verifyAccessToken(refused), refused);

      assert.deepEqual(provider.requests, []);
    });
  }

  for (const { label, changes } of [
    { label: 'an empty sid', changes: { sid: '' } },
    { label: 'a numeric sid', changes: { sid: 42 } },
    { label: 'an empty sub', changes: { sub: '' } },
    { label: 'an empty client_id', changes: { client_id: '', azp: undefined } },
    { label: 'a scope list', changes: { scope: ['openid'] } },
  ] satisfies { label: string; changes: TokenFields }[]) {
    test(`Given a signed token with ${label}, when it is verified, then it is refused as an invalid token and the provider gets no introspection request`, async () => {
      const { signer, provider, verifier } = verifierWithOwnKey();
      const refused = signer.sign(localUserClaims(changes));

      await assertInvalidToken(verifier.verifyAccessToken(refused), refused);

      assert.deepEqual(provider.requests, []);
    });
  }
});
