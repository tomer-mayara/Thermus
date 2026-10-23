import type { RoleGrant } from '../../../src/accounts/identity/access-context.ts';

// The expected hosted role catalog for offline fixtures. The fake lists roles in this order. The retired role has no
// application permission and exists only to exercise denial; a live environment does not need to define it.
export const hostedRolePermissions: Readonly<Record<string, readonly string[]>> = {
  user: ['product:access'],
  admin: ['product:access', 'user-grants:manage', 'admin-grants:manage', 'billing:manage'],
  'super-admin': [],
  member: [],
};

function grantOf(role: string): RoleGrant {
  return { role, permissions: hostedRolePermissions[role] };
}

export const userGrant: RoleGrant = grantOf('user');
export const adminGrant: RoleGrant = grantOf('admin');
// A retired role with no application permission, kept for refusal cases.
export const superAdminGrant: RoleGrant = grantOf('super-admin');
// The role that the provider gives a membership without another role. It gives no application permission.
export const memberRole: RoleGrant = grantOf('member');
