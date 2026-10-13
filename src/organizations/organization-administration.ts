import type { AuthenticatedUser, RoleGrant } from '../auth/access-context.ts';

export interface OrganizationMembership {
  readonly organizationId: string;
  readonly organizationName: string;
  readonly active: boolean;
  readonly grants: readonly RoleGrant[];
}

// The organization reads of customer organization work. An implementation reads the current provider state for each
// call and gives only the memberships of the user that it gets, each with every current grant. A grant holds only
// application permissions, so that a default role, which gives none, authorizes nothing. A failed read throws, so
// that a failure never looks like a missing membership.
export interface OrganizationDirectory {
  membershipsOf(user: AuthenticatedUser): Promise<readonly OrganizationMembership[]>;
}

export interface AuthorizedOrganization {
  readonly organizationId: string;
  readonly organizationName: string;
  // The browser session of the user selected this organization.
  readonly selected: boolean;
}

// Customer organization work: the onboarding, listing, and selection of the organizations of the signed-in user. The
// external operator sets up organizations and their Super Admins outside this service, so it has no method for them.
export class OrganizationAdministration {
  private readonly directory: OrganizationDirectory;

  constructor(directory: OrganizationDirectory) {
    this.directory = directory;
  }

  // Only active memberships whose grants give at least one application permission, because a default role gives none.
  // An empty list means that the user must accept an invitation or ask the operator: no default organization exists.
  async listOrganizations(user: AuthenticatedUser): Promise<readonly AuthorizedOrganization[]> {
    const memberships = await this.directory.membershipsOf(user);
    return Object.freeze(memberships.filter(isAuthorized).map((membership) => Object.freeze({
      organizationId: membership.organizationId,
      organizationName: membership.organizationName,
      selected: membership.organizationId === user.selectedOrganizationId,
    })));
  }

  // The organization ID comes from the request, so only the current memberships of the user can authorize it.
  async authorizeSelection(user: AuthenticatedUser, organizationId: string): Promise<AuthorizedOrganization | undefined> {
    const organizations = await this.listOrganizations(user);
    return organizations.find((organization) => organization.organizationId === organizationId);
  }
}

function isAuthorized(membership: OrganizationMembership): boolean {
  return membership.active && membership.grants.some((grant) => grant.permissions.length > 0);
}
