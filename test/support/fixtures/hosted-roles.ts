import type { RoleGrant } from '../../../src/auth/access-context.ts';

// The role catalog of the hosted edition, as the WorkOS staging environment defines it: each environment role with its
// application permissions. Keep this key order: the fake lists the roles in it. The fake answers with the catalog, the
// live gate checks the staging environment against it, and the organization site grants from it.
export const hostedRolePermissions: Readonly<Record<string, readonly string[]>> = {
  user: ['product:access'],
  admin: ['user-grants:manage'],
  'super-admin': ['admin-grants:manage', 'billing:manage'],
  member: [],
};

function grantOf(role: string): RoleGrant {
  return { role, permissions: hostedRolePermissions[role] };
}

export const userGrant: RoleGrant = grantOf('user');
export const adminGrant: RoleGrant = grantOf('admin');
export const superAdminGrant: RoleGrant = grantOf('super-admin');
// The role that the provider gives a membership without another role. It gives no application permission.
export const memberRole: RoleGrant = grantOf('member');
