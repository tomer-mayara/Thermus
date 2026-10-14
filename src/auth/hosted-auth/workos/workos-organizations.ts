import type { ListOrganizationMembershipsOptions, OrganizationMembershipStatus } from '@workos-inc/node';
import type { RoleGrant } from '../../access-context.ts';

interface MembershipRecord {
  readonly userId: string;
  readonly organizationId: string;
  readonly status: OrganizationMembershipStatus;
  readonly roles?: readonly { readonly slug: string }[];
}

interface RoleRecord {
  readonly slug: string;
  readonly permissions: readonly string[];
}

interface MembershipPage {
  readonly data: readonly MembershipRecord[];
  readonly listMetadata: { readonly after?: string | null };
}

// The reads of the pinned SDK client that access resolution needs. The client fits this shape.
export interface WorkOSOrganizationsOptions {
  readonly userManagement: {
    listOrganizationMemberships(options: ListOrganizationMembershipsOptions): Promise<MembershipPage>;
  };
  readonly authorization: {
    listOrganizationRoles(organizationId: string): Promise<{ readonly data: readonly RoleRecord[] }>;
  };
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
  ['admin', ['user-grants:manage']],
  ['super-admin', ['admin-grants:manage', 'billing:manage']],
]);
// A user has at most one membership in an organization. The limit only bounds the read.
const MEMBERSHIP_READ_LIMIT = 10;

export class WorkOSOrganizations {
  private readonly userManagement: WorkOSOrganizationsOptions['userManagement'];
  private readonly authorization: WorkOSOrganizationsOptions['authorization'];

  constructor(options: WorkOSOrganizationsOptions) {
    this.userManagement = options.userManagement;
    this.authorization = options.authorization;
  }

  // Each call reads WorkOS again, so a revoked membership or role stops access at the next request. A failed read
  // throws, so access fails closed. No active membership gives undefined.
  async activeGrants(userId: string, organizationId: string): Promise<readonly RoleGrant[] | undefined> {
    const membership = await this.activeMembership(userId, organizationId);
    if (membership === undefined) return undefined;
    if (membership.roles === undefined) {
      throw new HostedRoleConfigurationError(`A membership in the organization ${organizationId} has no role list. `
        + 'The WorkOS environment must allow multiple roles for each membership.');
    }
    const { data: roles } = await this.authorization.listOrganizationRoles(organizationId);
    const permissionsByRole = checkedRoleMapping(roles, organizationId);
    return Object.freeze(membership.roles.map(({ slug }) => grantOf(slug, permissionsByRole, organizationId)));
  }

  private async activeMembership(userId: string, organizationId: string): Promise<MembershipRecord | undefined> {
    const page = await this.userManagement.listOrganizationMemberships({ userId, organizationId, statuses: ['active'], limit: MEMBERSHIP_READ_LIMIT });
    if (page.data.length > 1 || Boolean(page.listMetadata.after)) {
      throw new Error('WorkOS answered more than one active membership, or a next page, for one user in one organization');
    }
    const [membership] = page.data;
    if (membership === undefined) return undefined;
    if (membership.userId !== userId || membership.organizationId !== organizationId || membership.status !== 'active') {
      throw new Error('WorkOS answered a membership that the read did not ask for');
    }
    return membership;
  }
}

// Each role of the organization must follow the mapping, also a role that this membership does not have.
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
        + 'The hosted role mapping needs the roles user, admin, and super-admin.');
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
    ? 'must give no application permission. Only user, admin, and super-admin give application permissions'
    : `must give exactly the application permissions ${expected.join(', ')}`;
  return `The WorkOS role ${slug} of the organization ${organizationId} ${rule}.`;
}
