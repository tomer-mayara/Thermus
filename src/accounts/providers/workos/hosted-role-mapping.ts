import type { RoleGrant } from '../../identity/access-context.ts';

export interface RoleRecord {
  readonly slug: string;
  readonly permissions: readonly string[];
}

// The WorkOS role configuration breaks the hosted role mapping, so no grant of the organization is given.
export class HostedRoleConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HostedRoleConfigurationError';
  }
}

const APPLICATION_PERMISSIONS: ReadonlySet<string> = new Set(['product:access', 'user-grants:manage', 'admin-grants:manage', 'billing:manage']);
// The hosted role mapping. Each other role, also the default role, must give no application permission.
const MAPPED_ROLE_PERMISSIONS: ReadonlyMap<string, readonly string[]> = new Map([
  ['user', ['product:access']],
  ['admin', ['product:access', 'user-grants:manage', 'admin-grants:manage', 'billing:manage']],
]);

/** True for a role of the hosted mapping, user or admin: the only roles that give an application permission. */
export function isMappedRole(slug: string): boolean {
  return MAPPED_ROLE_PERMISSIONS.has(slug);
}

// One grant for each role of a membership, with the application permissions of that role in its organization. Each
// role of the organization must follow the mapping, also a role that this membership does not have.
export function grantsOfRoles(membershipRoles: readonly { readonly slug: string }[], organizationRoles: readonly RoleRecord[], organizationId: string): readonly RoleGrant[] {
  const permissionsByRole = checkedRoleMapping(organizationRoles, organizationId);
  return Object.freeze(membershipRoles.map(({ slug }) => grantOf(slug, permissionsByRole, organizationId)));
}

function checkedRoleMapping(roles: readonly RoleRecord[], organizationId: string): ReadonlyMap<string, readonly string[]> {
  const permissionsByRole = new Map<string, readonly string[]>();
  for (const role of roles) {
    const permissions = applicationPermissionsOf(role);
    const expected = MAPPED_ROLE_PERMISSIONS.get(role.slug) ?? [];
    if (!haveSameMembers(permissions, expected)) throw new HostedRoleConfigurationError(mappingRule(role.slug, expected, organizationId));
    permissionsByRole.set(role.slug, permissions);
  }
  for (const slug of MAPPED_ROLE_PERMISSIONS.keys()) {
    if (!permissionsByRole.has(slug)) {
      throw new HostedRoleConfigurationError(`The WorkOS role ${slug} does not exist in the organization ${organizationId}. `
        + 'The hosted role mapping needs the roles user and admin.');
    }
  }
  return permissionsByRole;
}

function grantOf(slug: string, permissionsByRole: ReadonlyMap<string, readonly string[]>, organizationId: string): RoleGrant {
  const permissions = permissionsByRole.get(slug);
  if (permissions === undefined) {
    throw new HostedRoleConfigurationError(`A membership has the role ${slug}, but the organization ${organizationId} has no role with this slug.`);
  }
  return Object.freeze({ role: slug, permissions: Object.freeze([...permissions]) });
}

// A permission that only WorkOS knows gives no application access, so the mapping ignores it.
function applicationPermissionsOf(role: RoleRecord): readonly string[] {
  return [...new Set(role.permissions.filter((permission) => APPLICATION_PERMISSIONS.has(permission)))];
}

function haveSameMembers(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && expected.every((permission) => actual.includes(permission));
}

function mappingRule(slug: string, expected: readonly string[], organizationId: string): string {
  const rule = expected.length === 0
    ? 'must give no application permission. Only user and admin give application permissions'
    : `must give exactly the application permissions ${expected.join(', ')}`;
  return `The WorkOS role ${slug} of the organization ${organizationId} ${rule}.`;
}
