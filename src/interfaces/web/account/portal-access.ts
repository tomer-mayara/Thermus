import { AccessDeniedError, requirePermission } from '../../../accounts/identity/access-context.ts';
import type { AccountOperation } from './account-routes.ts';
import { noticePage } from './account-pages.ts';

// The product portal and MCP need User. Admin or Super Admin alone gives no product access.
export const PRODUCT_ACCESS = 'product:access';

const JSON_HEADERS: Readonly<Record<string, string>> = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

// The protected request of the portal: it shows the product access that the current grants of the selected
// organization give. The account routes checked the session and the current access first.
export function portalAccessOperation(publicBaseUrl: string, mcpResourceUrl: string): AccountOperation {
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
    const roles = context.grants.filter((grant) => grant.permissions.length > 0).map((grant) => grant.role);
    return Response.json({ organizationId: context.organizationId, roles, plan: 'free', mcpUrl: mcpResourceUrl }, { headers: JSON_HEADERS });
  };
}
