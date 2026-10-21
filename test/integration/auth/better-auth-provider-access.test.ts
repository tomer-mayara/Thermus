import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { BetterAuthProvider, LOCAL_USER_GRANT } from '../../../src/accounts/providers/better-auth/better-auth-provider.ts';
import { installationId, localSettings, TokenProviderDouble } from './fixtures/token-provider-double.ts';

const authority = `better-auth:${installationId}`;
const tenantId = `local:${installationId}`;

function resolverWith(...accounts: { id: string; banned: boolean | null }[]) {
  const provider = new TokenProviderDouble();
  for (const account of accounts) provider.accounts.set(account.id, account);
  return { provider, resolver: new BetterAuthProvider(provider.auth, localSettings) };
}

describe('BetterAuthProvider access resolution', () => {
  test('Given an installation ID, when the provider is made, then its authority and tenant come from that ID, and the one local grant is frozen', () => {
    const { resolver } = resolverWith();

    assert.equal(resolver.authority, authority);
    assert.equal(resolver.tenantId, tenantId);
    assert.deepEqual(LOCAL_USER_GRANT, { role: 'user', permissions: ['product:access'] });
    assert.ok(Object.isFrozen(LOCAL_USER_GRANT) && Object.isFrozen(LOCAL_USER_GRANT.permissions));
  });

  for (const banned of [null, false]) {
    test(`Given an enabled user (banned ${banned}), when its access is resolved, then it is allowed in the installation tenant with the one local grant and no organization, after one lookup of the current user`, async () => {
      const { provider, resolver } = resolverWith({ id: 'user-1', banned });

      const decision = await resolver.resolve({ authority, subject: 'user-1' });

      assert.deepEqual(decision, {
        allowed: true,
        context: {
          user: { authority, subject: 'user-1' },
          tenantId,
          grants: [{ role: 'user', permissions: ['product:access'] }],
          permissions: ['product:access'],
        },
      });
      assert.ok(decision.allowed && !('organizationId' in decision.context));
      assert.deepEqual(provider.calls, ['findUserById user-1']);
    });
  }

  test('Given an identity with a selected organization, when its access is resolved, then the context has only the authority and subject of the user and no organization', async () => {
    const { resolver } = resolverWith({ id: 'user-1', banned: null });

    const decision = await resolver.resolve({ authority, subject: 'user-1', selectedOrganizationId: 'org-1' });

    assert.ok(decision.allowed);
    assert.deepEqual(decision.context.user, { authority, subject: 'user-1' });
    assert.equal(decision.context.organizationId, undefined);
  });

  for (const { label, accounts } of [
    { label: 'a disabled user', accounts: [{ id: 'user-1', banned: true }] },
    { label: 'a deleted user', accounts: [] },
  ]) {
    test(`Given ${label}, when its access is resolved, then it is denied as account-inactive`, async () => {
      const { resolver } = resolverWith(...accounts);

      assert.deepEqual(await resolver.resolve({ authority, subject: 'user-1' }), { allowed: false, reason: 'account-inactive' });
    });
  }

  for (const other of ['better-auth:another-installation', 'https://auth.thermus.example']) {
    test(`Given an identity of the authority ${other}, when its access is resolved, then it is denied as account-inactive without a user lookup`, async () => {
      const { provider, resolver } = resolverWith({ id: 'user-1', banned: null });

      assert.deepEqual(await resolver.resolve({ authority: other, subject: 'user-1' }), { allowed: false, reason: 'account-inactive' });

      assert.deepEqual(provider.calls, []);
    });
  }

  test('Given a user lookup that fails, when access is resolved, then the lookup error reaches the caller unchanged', async () => {
    const { provider, resolver } = resolverWith({ id: 'user-1', banned: null });
    const failure = new Error('database is locked');
    provider.failures.set('findUserById', failure);

    await assert.rejects(resolver.resolve({ authority, subject: 'user-1' }), (error) => error === failure);
  });
});
