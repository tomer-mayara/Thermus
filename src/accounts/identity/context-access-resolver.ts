import { createRequestContext, type AccessDecision, type AccessResolver, type AuthenticatedUser } from './access-context.ts';
import type { VerifiedAccessContext } from './signed-access-context.ts';

const ACCOUNT_INACTIVE: AccessDecision = Object.freeze({ allowed: false, reason: 'account-inactive' });
const ORGANIZATION_REQUIRED: AccessDecision = Object.freeze({ allowed: false, reason: 'organization-required' });

/**
 * The access of one request at a tenant: the grants that the control plane read and signed into the verified context.
 * The tenant reads no membership. The token proves the subject and the organization at the AuthKit issuer; the
 * context gives the authority of the control plane, so the tenant ID is the tenant ID of the control plane.
 */
export class ContextAccessResolver implements AccessResolver {
  constructor(private readonly context: VerifiedAccessContext, private readonly tenantId: string) {}

  /** Allows the user of the token only when the token names the subject and the organization of the context. */
  async resolve(user: AuthenticatedUser): Promise<AccessDecision> {
    return accessOf(this.context, this.tenantId, user);
  }
}

function accessOf(context: VerifiedAccessContext, tenantId: string, user: AuthenticatedUser): AccessDecision {
  if (user.subject !== context.subject) return ACCOUNT_INACTIVE;
  if (user.selectedOrganizationId !== context.organizationId) return ORGANIZATION_REQUIRED;
  const trustedUser = { authority: context.authority, subject: context.subject, selectedOrganizationId: context.organizationId, ...(context.name === undefined ? {} : { name: context.name }) };
  return { allowed: true, context: createRequestContext({ user: trustedUser, tenantId, organizationId: context.organizationId, grants: context.grants }) };
}
