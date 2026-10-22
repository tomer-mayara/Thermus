import type { AssignableRole, OrganizationMembership } from './organization-directory.ts';

const ASSIGNABLE_ROLES: readonly AssignableRole[] = Object.freeze(['user', 'admin']);
// The permission needed to invite each customer role. User gives neither permission; Admin gives both.
const MANAGING_PERMISSION: Readonly<Record<AssignableRole, string>> = Object.freeze({ user: 'user-grants:manage', admin: 'admin-grants:manage' });
const BILLING_PERMISSION = 'billing:manage';

// The customer roles that the user of these memberships manages in the organization: only from an active membership
// there, and only from the permissions of its current grants.
export function managedRoles(memberships: readonly OrganizationMembership[], organizationId: string): readonly AssignableRole[] {
  const permissions = activePermissionsIn(memberships, organizationId);
  return ASSIGNABLE_ROLES.filter((role) => permissions.has(MANAGING_PERMISSION[role]));
}

export function managesBilling(memberships: readonly OrganizationMembership[], organizationId: string): boolean {
  return activePermissionsIn(memberships, organizationId).has(BILLING_PERMISSION);
}

function activePermissionsIn(memberships: readonly OrganizationMembership[], organizationId: string): ReadonlySet<string> {
  const membership = memberships.find((candidate) => candidate.organizationId === organizationId && candidate.active);
  return new Set(membership?.grants.flatMap((grant) => grant.permissions));
}

export function managedRole(managed: readonly AssignableRole[], role: string): AssignableRole | undefined {
  return managed.find((candidate) => candidate === role);
}
