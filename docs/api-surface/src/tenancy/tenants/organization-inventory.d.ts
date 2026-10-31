export type OrganizationList = {
    readonly status: 'complete';
    readonly organizationIds: ReadonlySet<string>;
} | {
    readonly status: 'unavailable';
    readonly reason: string;
};
export type OrganizationRead = {
    readonly status: 'present' | 'absent';
} | {
    readonly status: 'unavailable';
    readonly reason: string;
};
export interface DefaultRoleMembership {
    readonly organizationId: string;
    readonly membershipId: string;
}
export type DefaultRoleRead = {
    readonly status: 'complete';
    readonly memberships: readonly DefaultRoleMembership[];
} | {
    readonly status: 'unavailable';
    readonly reason: string;
};
export interface OrganizationInventory {
    listOrganizations(signal: AbortSignal): Promise<OrganizationList>;
    readOrganization(organizationId: string, signal: AbortSignal): Promise<OrganizationRead>;
    defaultRoleMemberships(signal: AbortSignal): Promise<DefaultRoleRead>;
}
