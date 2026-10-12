import assert from 'node:assert/strict';
import { test } from 'node:test';
import { IdentityVerifierSdkAdapter } from '../../../src/mcp/identity-verifier-sdk-adapter.ts';
import { InvalidAccessTokenError } from '../../../src/mcp/identity-verifier.ts';
import { IdentityVerifierMock } from './fixtures/identity-verifier-mock.ts';

test('Given verified claims, when the SDK adapter verifies a token, then it maps those claims and supplies the input token', async () => {
  const identity = {
    clientId: 'client',
    scopes: ['read'],
    expiresAtUnixSeconds: 2_524_608_000,
    resource: new URL('https://magumagu.example/mcp'),
  };
  const verifier = new IdentityVerifierMock(new Map([['raw-token', identity]]));
  const result = await new IdentityVerifierSdkAdapter(verifier).verifyAccessToken('raw-token');
  assert.deepEqual(result, {
    token: 'raw-token',
    clientId: 'client',
    scopes: ['read'],
    expiresAt: 2_524_608_000,
    resource: identity.resource,
  });
  result.scopes.push('write');
  assert.deepEqual(identity.scopes, ['read']);
  assert.deepEqual(verifier.calls, ['raw-token']);
});

test('Given an unknown token, when the mock verifies it, then it rejects it and records the call', async () => {
  const verifier = new IdentityVerifierMock();
  await assert.rejects(verifier.verifyAccessToken('unknown'), InvalidAccessTokenError);
  assert.deepEqual(verifier.calls, ['unknown']);
  assert.deepEqual(new IdentityVerifierMock().calls, []);
});
