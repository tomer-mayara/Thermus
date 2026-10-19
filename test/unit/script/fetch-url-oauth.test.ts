import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepareResponse, savedCredentials } from './fixtures/oauth-login-harness.ts';

const valid = { access_token: 'opaque-access', refresh_token: 'opaque-refresh', token_type: 'bEaReR', expires_in: 300, scope: 'openid offline_access' };

test('Given an OAuth response, when it becomes ready credentials, then expiry uses request start and unused identity data is discarded', async (t) => {
  assert.equal(await prepareResponse(t, { ...valid, id_token: 'private-unused-identity' }), 'opaque-access');
  assert.deepEqual(await savedCredentials(), {
    status: 'ready', accessToken: 'opaque-access', refreshToken: 'opaque-refresh', scope: 'openid offline_access', expiresAt: 301_000,
  });
});

test('Given no refresh token, when access is usable, then ready credentials do not invent offline support', async (t) => {
  assert.equal(await prepareResponse(t, { access_token: 'opaque-access', token_type: 'Bearer', expires_in: 300 }), 'opaque-access');
  assert.deepEqual(await savedCredentials(), { status: 'ready', accessToken: 'opaque-access', expiresAt: 301_000 });
});

for (const response of [
  { ...valid, token_type: 'DPoP' }, { ...valid, expires_in: undefined }, { ...valid, expires_in: 1.5 },
  { ...valid, expires_in: 0 }, { ...valid, expires_in: Infinity }, { ...valid, expires_in: Number.MAX_SAFE_INTEGER },
  { ...valid, access_token: 'private-secret\nHeader: unsafe' }, { ...valid, refresh_token: '' },
  { ...valid, access_token: 'x'.repeat(65_537) },
]) {
  test(`Given invalid token response field ${JSON.stringify(Object.keys(response))}, when credentials are prepared, then only a local failure is exposed`, async (t) => {
    await assert.rejects(() => prepareResponse(t, response), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /token response|OAuth preparation failed/i);
      assert.doesNotMatch(error.message, /private-secret|opaque-/);
      return true;
    });
    assert.equal(await savedCredentials(), null);
  });
}
