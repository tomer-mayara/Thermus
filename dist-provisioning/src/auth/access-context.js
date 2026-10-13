export class AccessDeniedError extends Error {
    reason;
    constructor(reason) {
        super('Access denied');
        this.name = 'AccessDeniedError';
        this.reason = reason;
    }
}
export function createRequestContext(access) {
    if (typeof access.tenantId !== 'string' || access.tenantId === '') {
        throw new TypeError('A request context needs a trusted tenant ID');
    }
    const grants = access.grants.map((grant) => Object.freeze({
        role: grant.role,
        permissions: Object.freeze([...grant.permissions]),
    }));
    return Object.freeze({
        user: copyUser(access.user),
        tenantId: access.tenantId,
        ...(access.organizationId === undefined ? {} : { organizationId: access.organizationId }),
        grants: Object.freeze(grants),
        permissions: Object.freeze(permissionsOfEveryGrant(grants)),
    });
}
export function requirePermission(context, permission) {
    if (!context.permissions.includes(permission))
        throw new AccessDeniedError('permission-required');
}
function permissionsOfEveryGrant(grants) {
    return [...new Set(grants.flatMap((grant) => grant.permissions))];
}
function copyUser(user) {
    return Object.freeze({
        authority: user.authority,
        subject: user.subject,
        ...(user.selectedOrganizationId === undefined ? {} : { selectedOrganizationId: user.selectedOrganizationId }),
    });
}
//# sourceMappingURL=access-context.js.map