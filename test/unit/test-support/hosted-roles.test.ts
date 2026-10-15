import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { adminGrant, hostedRolePermissions, memberRole, superAdminGrant, userGrant } from '../../support/fixtures/hosted-roles.ts';

describe('Hosted role catalog of the WorkOS fake, the hosted live gate, and the organization site', () => {
  test('Given the hosted role catalog, when its roles are listed, then they are user, admin, super-admin, and member, in this order, the order in which the WorkOS fake lists them', () => {
    assert.deepEqual(Object.keys(hostedRolePermissions), ['user', 'admin', 'super-admin', 'member']);
  });

  test('Given the four grants of the catalog, when each is compared with its role in the catalog, then it has the name of that role and exactly its permissions', () => {
    const grants = { user: userGrant, admin: adminGrant, 'super-admin': superAdminGrant, member: memberRole };

    for (const [role, grant] of Object.entries(grants)) {
      assert.deepEqual(grant, { role, permissions: hostedRolePermissions[role] }, `The grant of ${role} is not the role ${role} of the catalog.`);
    }
  });

  test('Given the member role, when its permissions are read, then it gives no permission', () => {
    assert.deepEqual(memberRole, { role: 'member', permissions: [] });
  });

  test('Given the catalog, when the permissions of all its roles are put together, then no permission is in two roles', () => {
    const permissions = Object.values(hostedRolePermissions).flat();

    const repeated = permissions.filter((permission, index) => permissions.indexOf(permission) !== index);

    assert.deepEqual(repeated, []);
  });
});
