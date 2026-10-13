import type { AuthenticatedUser, RoleGrant } from '../auth/access-context.ts';

// One membership of a user, with every current role grant of that membership.
export interface OrganizationMembership {
  readonly organizationId: string;
  readonly organizationName: string;
  readonly active: boolean;
  readonly grants: readonly RoleGrant[];
}

// The organization reads of customer organization work. An implementation reads the current provider state for each
// call and gives only the memberships of the user that it gets. A failed read throws, so that a failure never looks
// like a missing membership.
export interface OrganizationDirectory {
  membershipsOf(user: AuthenticatedUser): Promise<readonly OrganizationMembership[]>;
}
