import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NoAuthProvider } from '../../support/doubles/auth/no-auth-provider.ts';

test('Given the test-only NoAuthProvider, when supplied different token contents and caller identity, then it supplies one fixed synthetic identity and workspace with only product access', async () => {
  const resource = new URL('https://thermus.example/mcp');
  const provider = new NoAuthProvider(resource);
  const before = Math.floor(Date.now() / 1_000);
  const first = await provider.verifyAccessToken('arbitrary-token');
  const second = await provider.verifyAccessToken('another-token');
  const after = Math.floor(Date.now() / 1_000);
  assert.deepEqual(first.user, second.user);
  assert.deepEqual(first.scopes, []);
  assert.equal(first.resource.href, resource.href);
  assert.equal(first.issuer, 'https://synthetic-auth.thermus.invalid');
  assert.notEqual(first.clientId, first.user.subject);
  assert.ok(Number.isFinite(first.issuedAtUnixSeconds));
  assert.ok(first.issuedAtUnixSeconds >= before - 1 && first.issuedAtUnixSeconds <= after);
  assert.ok(Number.isFinite(first.expiresAtUnixSeconds) && first.expiresAtUnixSeconds > after);
  const decision = await provider.resolve({ authority: 'forged-authority', subject: 'forged-subject' });
  assert.equal(decision.allowed, true);
  if (!decision.allowed) assert.fail('synthetic product access was denied');
  assert.deepEqual(decision.context.user, first.user);
  assert.equal(decision.context.tenantId, 'synthetic-workspace');
  assert.deepEqual(decision.context.permissions, ['product:access']);
  assert.deepEqual(decision.context.grants, [{ role: 'user', permissions: ['product:access'] }]);
  assert.doesNotMatch(JSON.stringify({ first, second, decision }), /arbitrary-token|another-token|forged-/);
});
