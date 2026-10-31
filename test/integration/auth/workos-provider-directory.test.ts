import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import { GenericServerException } from '@workos-inc/node';
import { createRemoteJWKSet } from 'jose';
import type { AuthenticatedUser } from '../../../src/accounts/identity/access-context.ts';
import { WorkOSAuthProvider } from '../../../src/accounts/providers/workos/workos-auth-provider.ts';
import { HostedRoleConfigurationError } from '../../../src/accounts/providers/workos/hosted-role-mapping.ts';
import { WorkOSOrganizations } from '../../../src/accounts/providers/workos/workos-organizations.ts';
import { workosMembershipReads } from '../../../src/accounts/providers/workos/workos-membership-reads.ts';
import { workosAuthority } from '../../../src/accounts/providers/workos/workos-settings.ts';
import { nowInSeconds, SigningKey } from '../../support/doubles/workos/jwt-signing-key.ts';
import { fakeClientId, WorkOSFakeApi, workosClientFor, type FakeAnswer } from '../../support/doubles/workos/workos-fake-api.ts';
import { adminGrant, userGrant } from '../../support/fixtures/hosted-roles.ts';

const authority = workosAuthority(fakeClientId);
const mcpResourceUrl = 'https://localhost:46443/mcp';
const alice = 'user_01ALICE';
const acme = 'org_01ACME';
const aliceInAcme: AuthenticatedUser = { authority, subject: alice, selectedOrganizationId: acme };
const membershipsRoute = 'GET /user_management/organization_memberships';
const rolesRoute = `GET /authorization/organizations/${acme}/roles`;
const membershipRead = `${membershipsRoute}?user_id=${alice}&organization_id=${acme}&statuses=active&limit=10&order=desc`;
const internalError: FakeAnswer = { status: 500, body: { message: 'Internal error' } };

const authkitKey = await SigningKey.generate('authkit-key-1');

function membershipJson(roleSlugs: readonly string[] | undefined) {
  return {
    object: 'organization_membership',
    id: 'om_01ALICE',
    user_id: alice,
    organization_id: acme,
    organization_name: 'Acme',
    status: 'active',
    directory_managed: false,
    role: { slug: roleSlugs?.[0] ?? 'member' },
    ...(roleSlugs === undefined ? {} : { roles: roleSlugs.map((slug) => ({ slug })) }),
    custom_attributes: {},
    created_at: '2026-10-01T08:00:00.000Z',
    updated_at: '2026-10-13T08:00:00.000Z',
  };
}

function membershipsAnswer(...memberships: unknown[]): FakeAnswer {
  return { status: 200, body: { object: 'list', data: memberships, list_metadata: { before: null, after: null } } };
}

function roleJson(slug: string, permissions: readonly string[]) {
  return {
    object: 'role',
    id: `role_01${slug.toUpperCase().replaceAll('-', '')}`,
    name: slug,
    slug,
    description: null,
    permissions,
    type: 'EnvironmentRole',
    created_at: '2026-10-01T08:00:00.000Z',
    updated_at: '2026-10-01T08:00:00.000Z',
  };
}

// The expected hosted catalog, with the changes of a test. No retired role is required.
function rolesAnswer(changes: Readonly<Record<string, readonly string[] | undefined>> = {}): FakeAnswer {
  const roles: Record<string, readonly string[] | undefined> = {
    member: [],
    user: userGrant.permissions,
    admin: adminGrant.permissions,
    ...changes,
  };
  const data = Object.entries(roles).flatMap(([slug, permissions]) => permissions === undefined ? [] : [roleJson(slug, permissions)]);
  return { status: 200, body: { object: 'list', data } };
}

async function directoryWorld(t: TestContext) {
  const fake = await WorkOSFakeApi.start(t);
  fake.authkitKeySet.publish(authkitKey);
  const workos = workosClientFor(fake);
  const grants = new WorkOSOrganizations({ authority, memberships: workosMembershipReads(workos), userManagement: workos.userManagement, authorization: workos.authorization });
  const keySet = createRemoteJWKSet(fake.authkitKeySetUrl);
  const provider = new WorkOSAuthProvider({ authority, authkitIssuer: fake.authkitIssuer, mcpResourceUrl, keySet, grants });
  const requestLines = () => fake.takeRequests().map(({ method, path }) => `${method} ${path}`);
  return { fake, provider, requestLines };
}

describe('WorkOSAuthProvider with WorkOSOrganizations and the pinned WorkOS SDK', () => {
  test('Given a Connect token and a membership with the roles user and admin, when the token is verified and its access resolved, then the context has both grants and their combined permissions after one key-set read, one filtered membership read, and one role read', async (t) => {
    const { fake, provider, requestLines } = await directoryWorld(t);
    fake.answer(membershipsRoute, membershipsAnswer(membershipJson(['user', 'admin'])));
    fake.answer(rolesRoute, rolesAnswer());
    const token = await authkitKey.sign(
      { sub: alice, client_id: 'client_01MCPAPP', sid: 'app_consent_01ALICE', org_id: acme, scope: 'email offline_access openid profile' },
      { issuer: fake.authkitIssuer, audience: mcpResourceUrl, expiresAtUnixSeconds: nowInSeconds() + 300 },
    );

    const decision = await provider.resolve((await provider.verifyAccessToken(token)).user);

    assert.deepEqual(decision, {
      allowed: true,
      context: {
        user: aliceInAcme,
        tenantId: `${authority}:${acme}`,
        organizationId: acme,
        grants: [userGrant, adminGrant],
        permissions: adminGrant.permissions,
      },
    });
    assert.deepEqual(requestLines(), ['GET /authkit/oauth2/jwks', membershipRead, rolesRoute]);
  });

  test('Given a catalog with only User and Admin and an Admin-only membership, when access is resolved, then no Super Admin or default role is required and the context grants all Admin permissions', async (t) => {
    const { fake, provider } = await directoryWorld(t);
    fake.answer(membershipsRoute, membershipsAnswer(membershipJson(['admin'])));
    fake.answer(rolesRoute, rolesAnswer({ member: undefined }));

    const decision = await provider.resolve(aliceInAcme);

    assert.ok(decision.allowed);
    assert.deepEqual(decision.context.grants, [adminGrant]);
    assert.deepEqual(decision.context.permissions, adminGrant.permissions);
  });

  test('Given a membership with only the default role, when access is resolved, then it is allowed with the default grant and no permission', async (t) => {
    const { fake, provider } = await directoryWorld(t);
    fake.answer(membershipsRoute, membershipsAnswer(membershipJson(['member'])));
    fake.answer(rolesRoute, rolesAnswer());

    const decision = await provider.resolve(aliceInAcme);

    assert.ok(decision.allowed);
    assert.deepEqual([decision.context.grants, decision.context.permissions], [[{ role: 'member', permissions: [] }], []]);
  });

  test('Given no active membership, when access is resolved, then it is denied as membership-inactive after only the membership read', async (t) => {
    const { fake, provider, requestLines } = await directoryWorld(t);
    fake.answer(membershipsRoute, membershipsAnswer());

    assert.deepEqual(await provider.resolve(aliceInAcme), { allowed: false, reason: 'membership-inactive' });
    assert.deepEqual(requestLines(), [membershipRead]);
  });

  for (const { label, membership, roles, rule } of [
    { label: 'a default role that gives product:access', membership: ['member'], roles: rolesAnswer({ member: ['product:access'] }), rule: /role member .* must give no application permission/ },
    { label: 'no Admin role', membership: ['user'], roles: rolesAnswer({ admin: undefined }), rule: /role admin does not exist/ },
    { label: 'no User role', membership: ['admin'], roles: rolesAnswer({ user: undefined }), rule: /role user does not exist/ },
    { label: 'a retired Super Admin role with application permissions', membership: ['admin'], roles: rolesAnswer({ 'super-admin': ['admin-grants:manage', 'billing:manage'] }), rule: /role super-admin .* must give no application permission/ },
    { label: 'a membership without a role list', membership: undefined, roles: rolesAnswer(), rule: /no role list/ },
  ]) {
    test(`Given ${label}, when access is resolved, then it fails with a HostedRoleConfigurationError and gives no context`, async (t) => {
      const { fake, provider } = await directoryWorld(t);
      fake.answer(membershipsRoute, membershipsAnswer(membershipJson(membership)));
      fake.answer(rolesRoute, roles);

      await assert.rejects(provider.resolve(aliceInAcme), (error) => {
        assert.ok(error instanceof HostedRoleConfigurationError, String(error));
        assert.match(error.message, rule);
        return true;
      });
    });
  }

  for (const failingRoute of [membershipsRoute, rolesRoute]) {
    test(`Given WorkOS answers HTTP 500 to ${failingRoute}, when access is resolved, then the SDK failure reaches the caller, so access fails closed`, async (t) => {
      const { fake, provider } = await directoryWorld(t);
      fake.answer(membershipsRoute, membershipsAnswer(membershipJson(['user'])));
      fake.answer(rolesRoute, rolesAnswer());
      fake.answer(failingRoute, internalError);

      await assert.rejects(provider.resolve(aliceInAcme), GenericServerException);
    });
  }
});
