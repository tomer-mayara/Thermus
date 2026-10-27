import type { SystemLog } from '../logs/system/system-logger.ts';
import { ACCESS_CONTEXT_HEADER, type VerifiedAccessContext } from '../accounts/identity/signed-access-context.ts';
import type { AccessContextVerifier } from '../accounts/identity/access-context-verifier.ts';
import type { MCPServer, McpRequestScope } from '../interfaces/mcp/mcp-server.ts';
import type { FetchHandler } from '../runtime/http/server.ts';
import type { RouteConfig } from './application.ts';

/** The parts of the MCP resource of a tenant: the context check, the MCP server, and the scope of a verified context. */
export interface TenantMcp {
  readonly verifier: Pick<AccessContextVerifier, 'verify'>;
  readonly server: Pick<MCPServer, 'fetch'>;
  readonly scopeOf: (context: VerifiedAccessContext, header: string) => McpRequestScope;
  readonly logger: SystemLog;
}

const BEARER = /^Bearer ([^\s,]+)$/i;

/**
 * The MCP resource of a tenant. Only the gateway of the control plane reaches a tenant, so a request needs a verified
 * signed context: without one it gets 403 before any MCP handling. The MCP server then checks the bearer token, as
 * today, and takes the access and the audit relay of the request from its context.
 */
export function tenantMcpHandler(mcp: TenantMcp): FetchHandler {
  return async (request) => {
    const header = request.headers.get(ACCESS_CONTEXT_HEADER);
    const bearerToken = BEARER.exec(request.headers.get('Authorization') ?? '')?.[1];
    const verification = await mcp.verifier.verify(header, bearerToken);
    if (verification.status === 'verified') return mcp.server.fetch(request, mcp.scopeOf(verification.context, header ?? ''));
    // The reason names the failed check; the log never holds the context or the token.
    mcp.logger.error(`The tenant refused an MCP request before MCP handling: access context ${verification.reason}.`);
    return Response.json({ error: 'access_denied', error_description: 'Access denied' }, { status: 403 });
  };
}

/** The routes of a tenant: its health check and the MCP resource. Each other path gets 404. */
export function routeTenantRequests(config: Pick<RouteConfig, 'mcpResourceUrl'>, mcp: FetchHandler): FetchHandler {
  const mcpPath = new URL(config.mcpResourceUrl).pathname;
  return async (request) => {
    const path = new URL(request.url).pathname;
    if (path === '/healthz') return health(request);
    return path === mcpPath ? mcp(request) : new Response('Not Found', { status: 404 });
  };
}

// The same answers as the health check of the control plane: constant, without a provider call.
function health(request: Request): Response {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  return new Response(request.method === 'HEAD' ? null : 'ok\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}
