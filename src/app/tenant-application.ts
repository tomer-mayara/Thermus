import { createRemoteJWKSet } from 'jose';
import type { SystemLog } from '../logs/system/system-logger.ts';
import { AuditRelaySink, type AuditRelayOptions } from '../logs/audit/audit-relay-sink.ts';
import type { DeploymentConfig } from '../runtime/config/deployment-config.ts';
import { composeApplication, type Application } from './application.ts';
import { createHostedToolOperations } from './fetch-tool.ts';
import { assertHostedRenderer } from './hosted-renderer-startup.ts';
import { composeTenantMcp, type TenantMcpParts } from './tenant-mcp.ts';
import { routeTenantRequests } from './tenant-requests.ts';

type Environment = Readonly<Record<string, string | undefined>>;
type TenantConfig = Extract<DeploymentConfig, { role: 'tenant' }>;

/** The parts of a tenant that a composition root chooses. Production reaches AuthKit and the control plane. */
export interface TenantParts extends Omit<TenantMcpParts, 'relay'> {
  readonly relay?: AuditRelayOptions;
}

// No retry and a short timeout: the key set loads during an MCP request, as on the control plane.
const KEY_SET_TIMEOUT_MS = 5_000;

/** The hosted image in the tenant role. Its start reads no WorkOS secret and no database, and makes no network call. */
export async function openTenantApplication(config: TenantConfig, logger: SystemLog, environment: Environment): Promise<Application> {
  const operations = createHostedToolOperations(environment, logger);
  await assertHostedRenderer(environment.LIGHTPANDA_BIN);
  const { organizationId, authkitIssuer } = config.tenant;
  const authkitKeySet = createRemoteJWKSet(new URL(`${authkitIssuer}/oauth2/jwks`), { timeoutDuration: KEY_SET_TIMEOUT_MS });
  logger.info(`The tenant role serves the organization ${organizationId} with the AuthKit issuer ${authkitIssuer}.`);
  return composeTenantApplication(config, { logger, operations, authkitKeySet });
}

/**
 * The tenant serves /healthz and /mcp for its one organization. A request needs a context that the control plane
 * signed; its grants give the access, and the audit events of its tools go back to the control plane with it. Close
 * stops the requests and the tool calls first, then the relay drops its pending events.
 */
export function composeTenantApplication(config: TenantConfig, parts: TenantParts): Application {
  const relay = new AuditRelaySink(new URL('internal/audit', config.tenant.controlPlaneInternalUrl), parts.relay);
  const { server, handler } = composeTenantMcp(config, { ...parts, relay });
  const handle = routeTenantRequests(config, handler);
  const shutdown = new AbortController();
  return composeApplication((request) => handle(new Request(request, { signal: AbortSignal.any([request.signal, shutdown.signal]) })), {
    close: async () => {
      shutdown.abort(new DOMException('The tenant is shutting down', 'AbortError'));
      try { await server.close(); } finally { relay.close(); }
    },
  });
}
