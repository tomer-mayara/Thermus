import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  AccessDeniedError,
  createRequestContext,
  requirePermission,
  type AuthenticatedUser,
  type RoleGrant,
} from '../../../src/accounts/identity/access-context.ts';

const productAccess = 'product:access';
const userGrant: RoleGrant = { role: 'user', permissions: [productAccess] };
// Synthetic roles test explicit permission sets without representing the customer role catalog.
const userManagerGrant: RoleGrant = { role: 'test-user-manager', permissions: ['user-grants:manage'] };
const accountManagerGrant: RoleGrant = { role: 'test-account-manager', permissions: ['admin-grants:manage', 'billing:manage'] };
const member: AuthenticatedUser = { authority: 'https://auth.thermus.example', subject: 'user-1', selectedOrganizationId: 'org-1' };

function memberContext(grants: readonly RoleGrant[]) {
  return createRequestContext({ user: member, tenantId: 'tenant-org-1', organizationId: 'org-1', grants });
}

function deniedReason(check: () => void): string | undefined {
  try {
    check();
    return undefined;
  } catch (error) {
    assert.ok(error instanceof AccessDeniedError);
    return error.reason;
  }
}

describe('Request context permissions', () => {
  test('Given a User grant and a synthetic user-manager grant, when permissions are checked, then each grant contributes its explicit permissions', () => {
    const context = memberContext([userGrant, userManagerGrant]);

    assert.equal(deniedReason(() => requirePermission(context, productAccess)), undefined);
    assert.equal(deniedReason(() => requirePermission(context, 'user-grants:manage')), undefined);
    assert.equal(deniedReason(() => requirePermission(context, 'admin-grants:manage')), 'permission-required');
    assert.deepEqual(context.permissions, [productAccess, 'user-grants:manage']);
  });

  test('Given a synthetic account-manager grant alone, when product access is checked, then it is denied because the context adds no permission beyond the supplied grants', () => {
    const context = memberContext([accountManagerGrant]);

    assert.equal(deniedReason(() => requirePermission(context, productAccess)), 'permission-required');
    assert.equal(deniedReason(() => requirePermission(context, 'user-grants:manage')), 'permission-required');
    assert.equal(deniedReason(() => requirePermission(context, 'billing:manage')), undefined);
  });

  test('Given synthetic account-manager and User grants in either order, when the context is created, then it keeps every grant and the same complete permission set', () => {
    const first = memberContext([accountManagerGrant, userGrant]);
    const second = memberContext([userGrant, accountManagerGrant]);

    assert.deepEqual(first.grants.map(({ role }) => role), ['test-account-manager', 'user']);
    assert.deepEqual([...first.permissions].sort(), [...second.permissions].sort());
    assert.deepEqual([...first.permissions].sort(), ['admin-grants:manage', 'billing:manage', productAccess]);
    for (const permission of first.permissions) {
      assert.equal(deniedReason(() => requirePermission(second, permission)), undefined);
    }
  });

  test('Given grants that share a permission, when the context is created, then the permission set lists it once', () => {
    const context = memberContext([userGrant, { role: 'reviewer', permissions: [productAccess, 'reports:read'] }]);

    assert.deepEqual(context.permissions, [productAccess, 'reports:read']);
  });

  test('Given no grants, when any permission is checked, then access is denied with no default permission', () => {
    const context = memberContext([]);

    assert.deepEqual(context.permissions, []);
    assert.equal(deniedReason(() => requirePermission(context, productAccess)), 'permission-required');
  });

  test('Given a denied permission check, when the error reaches a client, then its message is a safe generic text', () => {
    assert.throws(
      () => requirePermission(memberContext([userManagerGrant]), productAccess),
      { name: 'AccessDeniedError', message: 'Access denied', reason: 'permission-required' },
    );
  });

  test('Given a context, when permissions are checked repeatedly, then each check gives the same result and changes nothing', () => {
    const context = memberContext([userGrant]);
    const before = structuredClone(context);

    requirePermission(context, productAccess);
    requirePermission(context, productAccess);

    assert.deepEqual(context, before);
  });
});

describe('Request context records', () => {
  test('Given mutable input records, when they change after the context is created, then the context keeps the trusted values', () => {
    const user = { ...member };
    const permissions = [productAccess];
    const grants = [{ role: 'user', permissions }];
    const context = createRequestContext({ user, tenantId: 'tenant-org-1', organizationId: 'org-1', grants });

    user.subject = 'user-2';
    permissions.push('billing:manage');
    grants.push({ role: 'test-user-manager', permissions: ['user-grants:manage'] });

    assert.deepEqual(context, {
      user: member,
      tenantId: 'tenant-org-1',
      organizationId: 'org-1',
      grants: [userGrant],
      permissions: [productAccess],
    });
  });

  test('Given a created context, when a handler tries to change it, then the context and its collections are frozen', () => {
    const context = memberContext([userGrant]);

    for (const value of [context, context.user, context.grants, context.grants[0], context.grants[0]?.permissions, context.permissions]) {
      assert.ok(Object.isFrozen(value));
    }
  });

  test('Given input with extra provider fields, when the context is created, then it keeps only the access contract fields', () => {
    const providerUser = { ...member, accessToken: 'raw-token', provider: { client: 'sdk-object' } };
    const providerGrant = { ...userGrant, providerRole: { id: 'role_01' } };

    const context = createRequestContext({
      user: providerUser,
      tenantId: 'tenant-org-1',
      organizationId: 'org-1',
      grants: [providerGrant],
    });

    assert.deepEqual(context.user, member);
    assert.deepEqual(context.grants, [userGrant]);
  });

  test('Given an installation user without an organization, when the context is created, then it has no organization', () => {
    const user: AuthenticatedUser = { authority: 'local:installation-1', subject: 'user-1' };

    const context = createRequestContext({ user, tenantId: 'local:installation-1', grants: [userGrant] });

    assert.deepEqual(context, { user, tenantId: 'local:installation-1', grants: [userGrant], permissions: [productAccess] });
    assert.equal('organizationId' in context, false);
  });

  for (const tenantId of ['', undefined]) {
    test(`Given ${tenantId === '' ? 'an empty' : 'no'} tenant ID, when a context is created, then creation fails instead of making a shared tenant`, () => {
      assert.throws(
        () => createRequestContext({ user: member, tenantId: tenantId as string, grants: [userGrant] }),
        TypeError,
      );
    });
  }
});

for (const name of ['Zoë O’Neil — 李', 'é'.repeat(512)]) {
  test('Given a trusted display name, when a request context is copied, then its frozen user keeps that optional name', () => {
    const context = createRequestContext({ user: Object.assign({}, member, { name }), tenantId: 'tenant', grants: [] });
    assert.equal((context.user as typeof member & { name?: string }).name, name);
    assert.ok(Object.isFrozen(context.user));
  });
}
