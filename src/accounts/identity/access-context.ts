export interface AuthenticatedUser {
  readonly authority: string;
  readonly subject: string;
  /** Display metadata only; never an authority or authorization input. */
  readonly name?: string;
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

export type AccessDenialReason =
  | 'account-inactive'
  | 'organization-required'
  | 'membership-inactive'
  | 'permission-required';

export type AccessDecision =
  | { readonly allowed: true; readonly context: RequestContext }
  | { readonly allowed: false; readonly reason: AccessDenialReason };

export interface AccessResolver {
  resolve(user: AuthenticatedUser): Promise<AccessDecision>;
}

export class AccessDeniedError extends Error {
  readonly reason: AccessDenialReason;

  constructor(reason: AccessDenialReason) {
    super('Access denied');
    this.name = 'AccessDeniedError';
    this.reason = reason;
  }
}

export interface RequestAccess {
  readonly user: AuthenticatedUser;
  readonly tenantId: string;
  readonly organizationId?: string;
  readonly grants: readonly RoleGrant[];
}

export function createRequestContext(access: RequestAccess): RequestContext {
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

export function requirePermission(context: RequestContext, permission: string): void {
  if (!context.permissions.includes(permission)) throw new AccessDeniedError('permission-required');
}

function permissionsOfEveryGrant(grants: readonly RoleGrant[]): string[] {
  return [...new Set(grants.flatMap((grant) => grant.permissions))];
}

function copyUser(user: AuthenticatedUser): AuthenticatedUser {
  const name = displayNameOf(user.name);
  return Object.freeze({
    authority: user.authority,
    subject: user.subject,
    ...(name === undefined ? {} : { name }),
    ...(user.selectedOrganizationId === undefined ? {} : { selectedOrganizationId: user.selectedOrganizationId }),
  });
}

function displayNameOf(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.isWellFormed() || /\p{Cc}/u.test(value) || Buffer.byteLength(value) > 1_024) return undefined;
  return value.trim() || undefined;
}
