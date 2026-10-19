import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { fetchUrlScript } from '../../support/processes/module-paths.ts';

const { readyToken } = await import(new URL('helper/oauth.ts', pathToFileURL(fetchUrlScript)).href);
const valid = { access_token: 'opaque-access', refresh_token: 'opaque-refresh', token_type: 'bEaReR', expires_in: 300, scope: 'openid offline_access' };

test('Given an OAuth response, when it becomes ready credentials, then expiry uses request start and unused identity data is discarded', () => {
  assert.deepEqual(readyToken({ ...valid, id_token: 'private-unused-identity' }, 1_000), {
    accessToken: 'opaque-access', refreshToken: 'opaque-refresh', scope: 'openid offline_access', expiresAt: 301_000,
  });
});

test('Given no refresh token, when access is usable, then ready credentials do not invent offline support', () => {
  assert.deepEqual(readyToken({ access_token: 'opaque-access', token_type: 'Bearer', expires_in: 300 }, 1_000), { accessToken: 'opaque-access', expiresAt: 301_000 });
});

for (const response of [
  { ...valid, token_type: 'DPoP' }, { ...valid, expires_in: undefined }, { ...valid, expires_in: 1.5 },
  { ...valid, expires_in: 0 }, { ...valid, expires_in: Infinity }, { ...valid, expires_in: Number.MAX_SAFE_INTEGER },
  { ...valid, access_token: 'private-secret\nHeader: unsafe' }, { ...valid, refresh_token: '' },
  { ...valid, access_token: 'x'.repeat(65_537) },
]) {
  test(`Given invalid token response field ${JSON.stringify(Object.keys(response))}, when credentials are prepared, then only a local failure is exposed`, () => {
    assert.throws(() => readyToken(response, 1_000), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /token response/i);
      assert.doesNotMatch(error.message, /private-secret|opaque-/);
      return true;
    });
  });
}
