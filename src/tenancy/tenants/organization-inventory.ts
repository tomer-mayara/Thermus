// The organizations of the identity provider, as the tenants owner needs them: the organization sweep compares the
// registry with them, and the fleet summary reports the memberships that bill a seat without product access. The WorkOS
// adapter of the workos owner implements it. Each operation gives a result for each answer of the provider; it rejects
// only when the caller's signal stops it.

/** The IDs of every organization, from every page, or unavailable: a failed page never looks like a complete list. */
export type OrganizationList =
  | { readonly status: 'complete'; readonly organizationIds: ReadonlySet<string> }
  | { readonly status: 'unavailable'; readonly reason: string };

/** One organization by its ID. absent: the provider answered that the organization does not exist. */
export type OrganizationRead =
  | { readonly status: 'present' | 'absent' }
  | { readonly status: 'unavailable'; readonly reason: string };

/**
 * An active membership whose roles give no product access, such as the default role alone. WorkOS counts each active
 * membership as a billed seat (plan section 7), so the fleet summary names it for the operator.
 */
export interface DefaultRoleMembership {
  readonly organizationId: string;
  readonly membershipId: string;
}

/** The default-role memberships of every organization, or unavailable: a failed page never looks like none. */
export type DefaultRoleRead =
  | { readonly status: 'complete'; readonly memberships: readonly DefaultRoleMembership[] }
  | { readonly status: 'unavailable'; readonly reason: string };

export interface OrganizationInventory {
  listOrganizations(signal: AbortSignal): Promise<OrganizationList>;
  readOrganization(organizationId: string, signal: AbortSignal): Promise<OrganizationRead>;
  defaultRoleMemberships(signal: AbortSignal): Promise<DefaultRoleRead>;
}
