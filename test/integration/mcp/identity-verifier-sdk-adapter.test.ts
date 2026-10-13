import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { OAuthError, OAuthErrorCode, type AuthInfo } from '@modelcontextprotocol/server';
import { IdentityVerifierSdkAdapter, verifiedUserOf } from '../../../src/mcp/identity-verifier-sdk-adapter.ts';
import { InvalidAccessTokenError, type VerifiedIdentity } from '../../../src/auth/identity-verifier.ts';
import { IdentityVerifierMock, type ConfiguredClaims } from '../../unit/mcp/fixtures/identity-verifier-mock.ts';

function verifiedIdentity(): VerifiedIdentity {
  return {
    user: { authority: 'https://auth.thermus.example', subject: 'user-1', selectedOrganizationId: 'org-1' },
    issuer: 'https://issuer.thermus.example/',
    clientId: 'client',
    scopes: ['read'],
    issuedAtUnixSeconds: 2_524_604_400,
    expiresAtUnixSeconds: 2_524_608_000,
    resource: new URL('https://thermus.example/mcp'),
  };
}

async function verify(claims: ConfiguredClaims | Error, token = 'raw-token', failures: unknown[] = []): Promise<AuthInfo> {
  const verifier = new IdentityVerifierMock(new Map([[token, claims]]));
  return new IdentityVerifierSdkAdapter(verifier, (cause) => failures.push(cause)).verifyAccessToken(token);
}

describe('IdentityVerifierSdkAdapter', () => {
  test('Given verified claims, when the SDK adapter verifies a token, then it maps those claims and supplies the input token', async () => {
    const identity = verifiedIdentity();
    const verifier = new IdentityVerifierMock(new Map([['raw-token', identity]]));
    const result = await new IdentityVerifierSdkAdapter(verifier, () => {}).verifyAccessToken('raw-token');
    assert.deepEqual({ ...result, extra: undefined }, {
      token: 'raw-token',
      clientId: 'client',
      scopes: ['read'],
      expiresAt: 2_524_608_000,
      resource: identity.resource,
      extra: undefined,
    });
    result.scopes.push('write');
    assert.deepEqual(identity.scopes, ['read']);
    assert.deepEqual(verifier.calls, ['raw-token']);
  });

  test('Given verified claims, when the SDK adapter verifies a token, then AuthInfo.extra carries the actual issuer, client, scope, time, audience, and user claims', async () => {
    const result = await verify(verifiedIdentity());

    assert.deepEqual(result.extra, {
      user: { authority: 'https://auth.thermus.example', subject: 'user-1', selectedOrganizationId: 'org-1' },
      issuer: 'https://issuer.thermus.example/',
      clientId: 'client',
      scopes: ['read'],
      issuedAt: 2_524_604_400,
      expiresAt: 2_524_608_000,
      audience: 'https://thermus.example/mcp',
    });
  });

  test('Given verified claims, when the provider records change after verification, then the SDK auth information keeps its own frozen copies', async () => {
    const identity = verifiedIdentity();
    const user = { ...identity.user };
    const scopes = [...identity.scopes];
    const result = await verify({ ...identity, user, scopes });

    user.subject = 'user-2';
    scopes.push('admin');
    identity.resource.pathname = '/other';

    assert.equal(verifiedUserOf(result).subject, 'user-1');
    assert.deepEqual(result.scopes, ['read']);
    assert.equal(result.resource?.href, 'https://thermus.example/mcp');
    for (const value of [result.extra, result.extra?.user, result.extra?.scopes]) assert.ok(Object.isFrozen(value));
  });

  test('Given a verified user without a selected organization, when the SDK adapter verifies a token, then the user carries no organization', async () => {
    const identity = verifiedIdentity();
    const result = await verify({ ...identity, user: { authority: 'local:installation-1', subject: 'user-1' } });

    assert.deepEqual(verifiedUserOf(result), { authority: 'local:installation-1', subject: 'user-1' });
  });

  for (const { label, claims } of [
    { label: 'no user', claims: { user: undefined } },
    { label: 'an empty user authority', claims: { user: { authority: '', subject: 'user-1' } } },
    { label: 'no user subject', claims: { user: { authority: 'https://auth.thermus.example' } } },
    { label: 'an empty selected organization', claims: { user: { authority: 'https://auth.thermus.example', subject: 'user-1', selectedOrganizationId: '' } } },
    { label: 'a client ID in place of the user subject', claims: { user: { authority: 'https://auth.thermus.example', subject: 'client' } } },
    { label: 'no issuer', claims: { issuer: '' } },
    { label: 'no client ID', claims: { clientId: undefined } },
    { label: 'no issue time', claims: { issuedAtUnixSeconds: undefined } },
    { label: 'an issue time that is not a number', claims: { issuedAtUnixSeconds: Number.NaN } },
    { label: 'no expiration time', claims: { expiresAtUnixSeconds: undefined } },
    { label: 'no audience', claims: { resource: undefined } },
    { label: 'an audience that is not a URL', claims: { resource: 'https://thermus.example/mcp' } },
  ]) {
    test(`Given verified claims with ${label}, when the SDK adapter verifies the token, then it rejects the token as invalid_token`, async () => {
      await assert.rejects(
        verify({ ...verifiedIdentity(), ...claims }),
        (error) => error instanceof OAuthError
          && error.code === OAuthErrorCode.InvalidToken
          && error.message === 'Invalid access token',
      );
    });
  }

  test('Given a provider rejection with private details, when the SDK adapter verifies the token, then it reports only invalid_token', async () => {
    await assert.rejects(
      verify(new InvalidAccessTokenError('issuer https://evil.example does not match')),
      (error) => error instanceof OAuthError
        && error.code === OAuthErrorCode.InvalidToken
        && error.message === 'Invalid access token',
    );
  });

  test('Given an unexpected provider failure, when the SDK adapter verifies the token, then the failure is not reported as a token rejection', async () => {
    const failure = new Error('provider outage');

    await assert.rejects(verify(failure), (error) => error === failure);
  });

  test('Given an unexpected provider failure, when the SDK adapter verifies the token, then it gives that cause once to the failure callback', async () => {
    const failure = new Error('provider outage');
    const failures: unknown[] = [];

    await assert.rejects(verify(failure, 'raw-token', failures), (error) => error === failure);

    assert.equal(failures.length, 1);
    assert.equal(failures[0], failure);
  });

  test('Given an accepted token, a provider rejection, or an identity without a usable user, when the SDK adapter verifies the token, then it gives no cause to the failure callback', async () => {
    const failures: unknown[] = [];

    await verify(verifiedIdentity(), 'raw-token', failures);
    await assert.rejects(verify(new InvalidAccessTokenError('malformed JWT payload'), 'raw-token', failures), OAuthError);
    await assert.rejects(verify({ ...verifiedIdentity(), user: undefined }, 'raw-token', failures), OAuthError);

    assert.deepEqual(failures, []);
  });

  test('Given an unknown token, when the mock verifies it, then it rejects it and records the call', async () => {
    const verifier = new IdentityVerifierMock();
    await assert.rejects(verifier.verifyAccessToken('unknown'), InvalidAccessTokenError);
    assert.deepEqual(verifier.calls, ['unknown']);
    assert.deepEqual(new IdentityVerifierMock().calls, []);
  });
});

describe('verifiedUserOf', () => {
  test('Given SDK auth information without adapter claims, when the verified user is read, then it fails instead of trusting other data', () => {
    const authInfo: AuthInfo = { token: 'raw-token', clientId: 'client', scopes: [], extra: { user: { authority: 'x' } } };

    assert.throws(() => verifiedUserOf(authInfo));
    assert.throws(() => verifiedUserOf({ ...authInfo, extra: undefined }));
  });
});
