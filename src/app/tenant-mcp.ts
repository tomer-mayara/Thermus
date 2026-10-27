import type { JWTVerifyGetKey } from 'jose';
import type { SystemLog } from '../logs/system/system-logger.ts';
import { AuditLog } from '../logs/audit/audit-log.ts';
import type { AuditRelaySink } from '../logs/audit/audit-relay-sink.ts';
import { AccessContextVerifier } from '../accounts/identity/access-context-verifier.ts';
import { ContextAccessResolver } from '../accounts/identity/context-access-resolver.ts';
import { hostedTenantId, WorkOSTokenVerifier } from '../accounts/providers/workos/workos-auth-provider.ts';
import { MCPServer } from '../interfaces/mcp/mcp-server.ts';
import { PRODUCT_ACCESS } from '../interfaces/web/account/portal-access.ts';
import type { DeploymentConfig } from '../runtime/config/deployment-config.ts';
import type { FetchHandler } from '../runtime/http/server.ts';
import { accessDeniedDescription, operatorFailureReporter } from './application.ts';
import { fetchToolServers, type ToolOperations } from './fetch-tool.ts';
import { tenantMcpHandler } from './tenant-requests.ts';

type TenantConfig = Extract<DeploymentConfig, { role: 'tenant' }>;

/** The collaborators of the MCP resource of a tenant. */
export interface TenantMcpParts {
  readonly logger: SystemLog;
  readonly operations: ToolOperations;
  readonly authkitKeySet: JWTVerifyGetKey;
  readonly relay: Pick<AuditRelaySink, 'forContext'>;
}

/**
 * The MCP server of a tenant and its handler. The server keeps the bearer check, the product permission, and the
 * per-request serving of today. The context of each admitted request gives its access and its audit relay.
 */
export function composeTenantMcp(config: TenantConfig, parts: TenantMcpParts): { readonly server: MCPServer; readonly handler: FetchHandler } {
  const { tenant } = config;
  // The token check knows the AuthKit issuer, not the authority of the control plane: the context gives that.
  const tokens = new WorkOSTokenVerifier({ authority: tenant.authkitIssuer, authkitIssuer: tenant.authkitIssuer, mcpResourceUrl: config.mcpResourceUrl, keySet: parts.authkitKeySet });
  const server = new MCPServer({
    auth: {
      verifier: tokens,
      // A request without the scope of a verified context gets no access.
      accessResolver: { resolve: async () => ({ allowed: false, reason: 'organization-required' }) },
      resourceMetadataUrl: config.resourceMetadataUrl,
      expectedResource: new URL(config.mcpResourceUrl),
      requiredPermission: PRODUCT_ACCESS,
      accessDeniedDescription: accessDeniedDescription(config.publicBaseUrl),
    },
    reportFailure: operatorFailureReporter(parts.logger),
  });
  const handler = tenantMcpHandler({
    verifier: new AccessContextVerifier({ publicKeys: tenant.gatewayPublicKeys, organizationId: tenant.organizationId }),
    server,
    scopeOf: (context, header) => ({
      accessResolver: new ContextAccessResolver(context, hostedTenantId(context.authority, context.organizationId)),
      buildServer: fetchToolServers(parts.operations, parts.logger, new AuditLog(parts.relay.forContext(header))),
    }),
    logger: parts.logger,
  });
  return { server, handler };
}
