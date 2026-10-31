import type { BillingState } from '../../../accounts/billing/billing.ts';
import { AccessDeniedError, requirePermission, type AuthenticatedUser } from '../../../accounts/identity/access-context.ts';
import { waitForRequest } from '../../../runtime/http/request-cancellation.ts';
import type { AccountOperation } from './account-routes.ts';
import { noticePage } from './account-pages.ts';

export const PRODUCT_ACCESS = 'product:access';

const JSON_HEADERS: Readonly<Record<string, string>> = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

export interface PortalReads {
  // The name of the active membership of the user, or undefined without one.
  organizationNameOf(user: AuthenticatedUser, organizationId: string): Promise<string | undefined>;
  billingOf(organizationId: string): Promise<BillingState>;
}

export function portalAccessOperation(publicBaseUrl: string, mcpResourceUrl: string, reads: PortalReads): AccountOperation {
  const path = new URL('portal/access', publicBaseUrl.endsWith('/') ? publicBaseUrl : `${publicBaseUrl}/`).pathname;
  return async (request, context) => {
    if (new URL(request.url).pathname !== path) return noticePage('notFound');
    if (request.method !== 'GET' && request.method !== 'HEAD') return noticePage('methodNotAllowed', { Allow: 'GET, HEAD' });
    try {
      requirePermission(context, PRODUCT_ACCESS);
    } catch (error) {
      if (error instanceof AccessDeniedError) return Response.json({ access: 'denied' }, { status: 403, headers: JSON_HEADERS });
      throw error;
    }
    const organizationId = context.organizationId;
    const organizationName = organizationId === undefined ? undefined : await waitForRequest(request.signal, () => reads.organizationNameOf(context.user, organizationId));
    request.signal.throwIfAborted();
    if (organizationId === undefined || typeof organizationName !== 'string' || organizationName.trim() === '') return Response.json({ access: 'unavailable' }, { status: 503, headers: JSON_HEADERS });
    const billing = await waitForRequest(request.signal, () => reads.billingOf(organizationId));
    request.signal.throwIfAborted();
    const roles = context.grants.filter((grant) => grant.permissions.length > 0).map((grant) => grant.role);
    return Response.json({ organizationId, organizationName, roles, ...planOf(billing), mcpUrl: mcpResourceUrl }, { headers: JSON_HEADERS });
  };
}

function planOf(billing: BillingState) {
  return billing.plan === 'free' ? { plan: billing.plan, memberLimit: billing.memberLimit } : { plan: billing.plan };
}
