export interface AuthenticatedUser {
    readonly authority: string;
    readonly subject: string;
    readonly selectedOrganizationId?: string;
}
export interface RoleGrant {
    readonly role: string;
    readonly permissions: readonly string[];
}
export interface RequestContext {
    readonly user: AuthenticatedUser;
    readonly tenantId: string;
    readonly organizationId?: string;
    readonly grants: readonly RoleGrant[];
    readonly permissions: readonly string[];
}
export type AccessDenialReason = 'account-inactive' | 'organization-required' | 'membership-inactive' | 'permission-required';
export type AccessDecision = {
    readonly allowed: true;
    readonly context: RequestContext;
} | {
    readonly allowed: false;
    readonly reason: AccessDenialReason;
};
export interface AccessResolver {
    resolve(user: AuthenticatedUser): Promise<AccessDecision>;
}
export declare class AccessDeniedError extends Error {
    readonly reason: AccessDenialReason;
    constructor(reason: AccessDenialReason);
}
export interface RequestAccess {
    readonly user: AuthenticatedUser;
    readonly tenantId: string;
    readonly organizationId?: string;
    readonly grants: readonly RoleGrant[];
}
export declare function createRequestContext(access: RequestAccess): RequestContext;
export declare function requirePermission(context: RequestContext, permission: string): void;
