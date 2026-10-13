import type { RoleGrant } from '../auth/access-context.ts';
import type { AssignableRole, GrantAction, OrganizationMembership } from './organization-directory.ts';

export interface RoleChange {
  readonly role: AssignableRole;
  readonly action: GrantAction;
}

const ASSIGNABLE_ROLES: readonly AssignableRole[] = Object.freeze(['user', 'admin']);
const GRANT_ACTIONS: readonly GrantAction[] = Object.freeze(['grant', 'revoke']);
// The permission that a member needs in the organization to grant, revoke, or invite each customer role. User gives
// none of them, and no customer permission manages Super Admin.
const MANAGING_PERMISSION: Readonly<Record<AssignableRole, string>> = Object.freeze({ user: 'user-grants:manage', admin: 'admin-grants:manage' });

// The customer roles that the user of these memberships manages in the organization: only from an active membership
// there, and only from the permissions of its current grants, so that no role inherits another.
export function managedRoles(memberships: readonly OrganizationMembership[], organizationId: string): readonly AssignableRole[] {
  const membership = memberships.find((candidate) => candidate.organizationId === organizationId && candidate.active);
  const permissions = new Set(membership?.grants.flatMap((grant) => grant.permissions));
  return ASSIGNABLE_ROLES.filter((role) => permissions.has(MANAGING_PERMISSION[role]));
}

// The role and the action of a request, when the actor manages that role; otherwise undefined. Any other text, such as
// 'super-admin' or 'deactivate', names no customer change.
export function managedChange(managed: readonly AssignableRole[], requested: { readonly role: string; readonly action: string }): RoleChange | undefined {
  const role = managed.find((candidate) => candidate === requested.role);
  const action = GRANT_ACTIONS.find((candidate) => candidate === requested.action);
  return role === undefined || action === undefined ? undefined : { role, action };
}

export function managedRole(managed: readonly AssignableRole[], role: string): AssignableRole | undefined {
  return managed.find((candidate) => candidate === role);
}

export function hasRole(grants: readonly RoleGrant[], role: string): boolean {
  return grants.some((grant) => grant.role === role);
}
