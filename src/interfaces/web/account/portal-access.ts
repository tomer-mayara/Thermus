import type { BillingState } from '../../../accounts/billing/billing.ts';
import { AccessDeniedError, requirePermission, type AuthenticatedUser } from '../../../accounts/identity/access-context.ts';
import { waitForRequest } from '../../../runtime/http/request-cancellation.ts';
import type { AccountOperation } from './account-routes.ts';
import { noticePage } from './account-pages.ts';

// The product portal and MCP need product access, which User and Admin both give.
export const PRODUCT_ACCESS = 'product:access';

// The headers of each JSON answer of the protected portal reads.
export const PORTAL_JSON_HEADERS: Readonly<Record<string, string>> = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

/** The access denial of a protected portal read without product access: 403 without organization data. */
export function portalAccessDenied(): Response {
  return Response.json({ access: 'denied' }, { status: 403, headers: PORTAL_JSON_HEADERS });
}

// The current reads of the portal answer for the organization that access resolution selected.
export interface PortalReads {
  // The name of the active membership of the user, or undefined without one.
  organizationNameOf(user: AuthenticatedUser, organizationId: string): Promise<string | undefined>;
  billingOf(organizationId: string): Promise<BillingState>;
}

// The protected request of the portal: it shows the product access that the current grants of the selected
// organization give, and the plan of that organization. The account routes checked the session and the current access
// first.
export function portalAccessOperation(publicBaseUrl: string, mcpResourceUrl: string, reads: PortalReads): AccountOperation {
  const path = new URL('portal/access', publicBaseUrl.endsWith('/') ? publicBaseUrl : `${publicBaseUrl}/`).pathname;
  return async (request, context) => {
    if (new URL(request.url).pathname !== path) return noticePage('notFound');
    if (request.method !== 'GET' && request.method !== 'HEAD') return noticePage('methodNotAllowed', { Allow: 'GET, HEAD' });
    try {
      requirePermission(context, PRODUCT_ACCESS);
    } catch (error) {
      if (error instanceof AccessDeniedError) return portalAccessDenied();
      throw error;
    }
    const organizationId = context.organizationId;
    const organizationName = organizationId === undefined ? undefined : await waitForRequest(request.signal, () => reads.organizationNameOf(context.user, organizationId));
    request.signal.throwIfAborted();
    if (organizationId === undefined || typeof organizationName !== 'string' || organizationName.trim() === '') return Response.json({ access: 'unavailable' }, { status: 503, headers: PORTAL_JSON_HEADERS });
    const billing = await waitForRequest(request.signal, () => reads.billingOf(organizationId));
    request.signal.throwIfAborted();
    const roles = context.grants.filter((grant) => grant.permissions.length > 0).map((grant) => grant.role);
    return Response.json({ organizationId, organizationName, roles, ...planOf(billing), mcpUrl: mcpResourceUrl }, { headers: PORTAL_JSON_HEADERS });
  };
}

// Only the plan facts that the portal shows: a free plan with its member limit, or the team plan.
function planOf(billing: BillingState) {
  return billing.plan === 'free' ? { plan: billing.plan, memberLimit: billing.memberLimit } : { plan: billing.plan };
}
