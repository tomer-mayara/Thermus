import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createLocalJWKSet, type JWTPayload } from 'jose';
import type { AuthenticatedUser, RoleGrant } from '../../../src/accounts/identity/access-context.ts';
import { hostedTenantId, WorkOSAuthProvider } from '../../../src/accounts/providers/workos/workos-auth-provider.ts';
import { HostedRoleConfigurationError } from '../../../src/accounts/providers/workos/hosted-role-mapping.ts';
import { workosAuthority } from '../../../src/accounts/providers/workos/workos-settings.ts';
import { nowInSeconds, SigningKey } from '../../support/doubles/workos/jwt-signing-key.ts';

const authority = workosAuthority('client_01ENVIRONMENT');
const authkitIssuer = 'https://reasonable-field-33-staging.authkit.app';
const mcpResourceUrl = 'https://localhost:46443/mcp';
const alice = 'user_01ALICE';
const acme = 'org_01ACME';
const aliceInAcme: AuthenticatedUser = { authority, subject: alice, selectedOrganizationId: acme };

const userGrant: RoleGrant = { role: 'user', permissions: ['product:access'] };
// Synthetic roles test the grant-reader seam without representing the customer role catalog.
const userManagerGrant: RoleGrant = { role: 'test-user-manager', permissions: ['user-grants:manage'] };
const accountManagerGrant: RoleGrant = { role: 'test-account-manager', permissions: ['admin-grants:manage', 'billing:manage'] };
const memberGrant: RoleGrant = { role: 'member', permissions: [] };

type GrantAnswer = readonly RoleGrant[] | undefined | Error;

class GrantReaderDouble {
  readonly reads: { userId: string; organizationId: string }[] = [];
  private readonly answers: ReadonlyMap<string, GrantAnswer>;

  constructor(answers: ReadonlyMap<string, GrantAnswer>) {
    this.answers = answers;
  }

  async activeGrants(userId: string, organizationId: string): Promise<readonly RoleGrant[] | undefined> {
    this.reads.push({ userId, organizationId });
    const answer = this.answers.get(organizationId);
    if (answer instanceof Error) throw answer;
    return answer;
  }
}

const authkitKey = await SigningKey.generate('authkit-key-1');

function providerWith(answers: ReadonlyMap<string, GrantAnswer>) {
  const grants = new GrantReaderDouble(answers);
  const keySet = createLocalJWKSet({ keys: [authkitKey.publicJwk] });
  return { grants, provider: new WorkOSAuthProvider({ authority, authkitIssuer, mcpResourceUrl, keySet, grants }) };
}

function connectToken(changes: JWTPayload): Promise<string> {
  const claims = { sub: alice, client_id: 'client_01MCPAPP', sid: 'app_consent_01ALICE', org_id: acme, scope: 'openid profile', ...changes };
  return authkitKey.sign(claims, { issuer: authkitIssuer, audience: mcpResourceUrl, expiresAtUnixSeconds: nowInSeconds() + 300 });
}

describe('WorkOSAuthProvider access resolution', () => {
  test('Given a WorkOS authority and an organization ID, when the hosted tenant ID is made, then it comes from only these two values', () => {
    assert.equal(hostedTenantId('workos:client_01ENVIRONMENT', 'org_01ACME'), 'workos:client_01ENVIRONMENT:org_01ACME');
  });

  test('Given an active membership with User and synthetic user-manager grants, when access is resolved, then it is allowed in the tenant of the organization with both grants and their combined permissions, after one fresh read', async () => {
    const { grants, provider } = providerWith(new Map([[acme, [userGrant, userManagerGrant]]]));

    const decision = await provider.resolve(aliceInAcme);

    assert.deepEqual(decision, {
      allowed: true,
      context: {
        user: aliceInAcme,
        tenantId: `${authority}:${acme}`,
        organizationId: acme,
        grants: [userGrant, userManagerGrant],
        permissions: ['product:access', 'user-grants:manage'],
      },
    });
    assert.ok(decision.allowed && Object.isFrozen(decision.context));
    assert.deepEqual(grants.reads, [{ userId: alice, organizationId: acme }]);
  });

  test('Given only synthetic management grants without product permission, when access is resolved, then it is allowed with each grant, because each operation checks its required permission', async () => {
    const { provider } = providerWith(new Map([[acme, [accountManagerGrant, userManagerGrant]]]));

    const decision = await provider.resolve(aliceInAcme);

    assert.ok(decision.allowed);
    assert.deepEqual(decision.context.grants, [accountManagerGrant, userManagerGrant]);
    assert.deepEqual(decision.context.permissions, ['admin-grants:manage', 'billing:manage', 'user-grants:manage']);
  });

  test('Given only the default role, when access is resolved, then it is allowed with a context that has no permission', async () => {
    const { provider } = providerWith(new Map([[acme, [memberGrant]]]));

    const decision = await provider.resolve(aliceInAcme);

    assert.ok(decision.allowed);
    assert.deepEqual([decision.context.grants, decision.context.permissions], [[memberGrant], []]);
  });

  test('Given no active membership in the selected organization, when access is resolved, then it is denied as membership-inactive', async () => {
    const { grants, provider } = providerWith(new Map([[acme, undefined]]));

    assert.deepEqual(await provider.resolve(aliceInAcme), { allowed: false, reason: 'membership-inactive' });
    assert.deepEqual(grants.reads, [{ userId: alice, organizationId: acme }]);
  });

  for (const selectedOrganizationId of [undefined, '']) {
    test(`Given a WorkOS user with the selected organization ${JSON.stringify(selectedOrganizationId)}, when access is resolved, then it is denied as organization-required without a read`, async () => {
      const { grants, provider } = providerWith(new Map([[acme, [userGrant]]]));
      const user: AuthenticatedUser = selectedOrganizationId === undefined ? { authority, subject: alice } : { authority, subject: alice, selectedOrganizationId };

      assert.deepEqual(await provider.resolve(user), { allowed: false, reason: 'organization-required' });
      assert.deepEqual(grants.reads, []);
    });
  }

  for (const other of ['workos:client_02OTHERENVIRONMENT', 'better-auth:installation-1', authkitIssuer]) {
    test(`Given a user of the authority ${other}, when access is resolved, then it is denied as account-inactive without a read`, async () => {
      const { grants, provider } = providerWith(new Map([[acme, [userGrant]]]));

      assert.deepEqual(await provider.resolve({ authority: other, subject: alice, selectedOrganizationId: acme }), { allowed: false, reason: 'account-inactive' });
      assert.deepEqual(grants.reads, []);
    });
  }

  for (const failure of [new Error('WorkOS answered HTTP 503'), new HostedRoleConfigurationError('The WorkOS role member must give no application permission.')]) {
    test(`Given a grant read that fails with ${failure.name}, when access is resolved, then the same error reaches the caller, so access fails closed`, async () => {
      const { provider } = providerWith(new Map([[acme, failure]]));

      await assert.rejects(provider.resolve(aliceInAcme), (error) => error === failure);
    });
  }

  test('Given Connect tokens of one user in one organization from two MCP clients, when each is verified and resolved, then both contexts have the same tenant, and another organization has another tenant', async () => {
    const globex = 'org_02GLOBEX';
    const { provider } = providerWith(new Map([[acme, [userGrant]], [globex, [userGrant]]]));
    const tenantOf = async (changes: JWTPayload) => {
      const decision = await provider.resolve((await provider.verifyAccessToken(await connectToken(changes))).user);
      assert.ok(decision.allowed);
      return decision.context.tenantId;
    };

    const tenants = [
      await tenantOf({ client_id: 'client_01MCPAPP' }),
      await tenantOf({ client_id: 'client_02OTHERAPP' }),
      await tenantOf({ client_id: 'client_01MCPAPP', org_id: globex }),
    ];

    assert.deepEqual(tenants, [`${authority}:${acme}`, `${authority}:${acme}`, `${authority}:${globex}`]);
  });
});
