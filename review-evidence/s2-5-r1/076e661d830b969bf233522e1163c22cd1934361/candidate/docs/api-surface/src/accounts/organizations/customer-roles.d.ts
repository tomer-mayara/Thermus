import type { AssignableRole, OrganizationMembership } from './organization-directory.ts';
export declare function managedRoles(memberships: readonly OrganizationMembership[], organizationId: string): readonly AssignableRole[];
export declare function managesBilling(memberships: readonly OrganizationMembership[], organizationId: string): boolean;
export declare function managedRole(managed: readonly AssignableRole[], role: string): AssignableRole | undefined;
