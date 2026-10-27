import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { AuthenticatedUser } from '../../../src/accounts/identity/access-context.ts';
import { ContextAccessResolver } from '../../../src/accounts/identity/context-access-resolver.ts';
import type { VerifiedAccessContext } from '../../../src/accounts/identity/signed-access-context.ts';

const pinned = 'org_01PINNED';
const context: VerifiedAccessContext = {
  authority: 'workos:client_01CONTROL',
  subject: 'user_01READER',
  name: 'Ann Reader',
  organizationId: pinned,
  grants: [{ role: 'user', permissions: ['product:access'] }, { role: 'admin', permissions: ['product:access', 'billing:manage'] }],
  expiresAtUnixSeconds: 4_102_444_800,
};
const tenantId = 'workos:client_01CONTROL:org_01PINNED';
// The token check of a tenant knows the AuthKit issuer, not the authority of the control plane.
const tokenUser: AuthenticatedUser = { authority: 'https://thermus-test.authkit.app', subject: 'user_01READER', selectedOrganizationId: pinned };

describe('Access from a verified signed context', () => {
  test('Given a verified context for the pinned organization and the user of its token, when access resolves, then it gives the grants of the context with the authority, the name, and the organization that the control plane signed', async () => {
    const decision = await new ContextAccessResolver(context, tenantId).resolve(tokenUser);

    assert.ok(decision.allowed);
    assert.deepEqual(decision.context, {
      user: { authority: 'workos:client_01CONTROL', subject: 'user_01READER', name: 'Ann Reader', selectedOrganizationId: pinned },
      tenantId,
      organizationId: pinned,
      grants: context.grants,
      permissions: ['product:access', 'billing:manage'],
    });
    assert.ok(Object.isFrozen(decision.context) && Object.isFrozen(decision.context.user));
  });

  const refused: ReadonlyArray<[string, AuthenticatedUser, string]> = [
    ['a token of another organization', { ...tokenUser, selectedOrganizationId: 'org_01OTHER' }, 'organization-required'],
    ['a token without an organization', { authority: tokenUser.authority, subject: tokenUser.subject }, 'organization-required'],
    ['a token of another user', { ...tokenUser, subject: 'user_01OTHER' }, 'account-inactive'],
  ];
  for (const [label, user, reason] of refused) {
    test(`Given a verified context for the pinned organization and ${label}, when access resolves, then it gives nothing`, async () => {
      assert.deepEqual(await new ContextAccessResolver(context, tenantId).resolve(user), { allowed: false, reason });
    });
  }

  test('Given a verified context without a name, when access resolves, then the user has no name', async () => {
    const { name: _name, ...unnamed } = context;

    const decision = await new ContextAccessResolver(unnamed, tenantId).resolve(tokenUser);

    assert.ok(decision.allowed);
    assert.equal('name' in decision.context.user, false);
  });
});
