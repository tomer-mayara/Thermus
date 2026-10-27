import { AccessContextSigner } from '../accounts/identity/access-context-signer.ts';
import { AccessContextVerifier } from '../accounts/identity/access-context-verifier.ts';
import type { SystemLog } from '../logs/system/system-logger.ts';
import type { AuditLog } from '../logs/audit/audit-log.ts';
import { McpGateway, type GatewayTenants } from '../interfaces/mcp/mcp-gateway.ts';
import type { McpForwardStep } from '../interfaces/mcp/mcp-server.ts';
import { AuditRelayRoute, type RelayContextCheck } from '../interfaces/web/internal/audit-relay-route.ts';
import { DeploymentConfigError } from '../runtime/config/deployment-config.ts';
import type { GatewaySettings } from '../runtime/config/gateway-settings.ts';
import { TenantActivity } from '../tenancy/tenants/tenant-activity.ts';
import type { TenantLookup } from '../tenancy/tenants/tenant-lookup.ts';
import type { TenantRequests } from '../tenancy/tenants/tenant-requests.ts';
import type { TenantResume } from '../tenancy/tenants/tenant-resume.ts';
import { TenantResumes } from '../tenancy/tenants/tenant-resumes.ts';
import type { HostedLoggingStorage } from './logging-storage.ts';

/** The parts of the MCP gateway with MCP_TENANTS_ENABLED on: its settings and the tenant registry. */
export interface GatewayParts {
  readonly settings: GatewaySettings;
  readonly tenants: GatewayTenants;
}

/** The registry rules of the tenants owner that the gateway uses. */
export interface GatewayRegistry {
  readonly lookup: Pick<TenantLookup, 'find'>;
  readonly requests: Pick<TenantRequests, 'request'>;
  readonly resumes: Pick<TenantResumes, 'resume'>;
  readonly activity: Pick<TenantActivity, 'recordActive'>;
}

/**
 * The resume operation until SO-10 connects it to the Render API: each call fails with one log line, and the row goes
 * back to suspended. No tenant is suspended before the idle sweep of SO-10 runs.
 */
export const unconnectedResume: TenantResume = {
  resume: async () => ({ status: 'failed', reason: 'The resume operation is not connected yet (SO-10).' }),
};

/** The gateway parts of the production control plane: the gateway settings and the registry of the hosted storage. */
export function gatewayPartsOf(settings: GatewaySettings, storage: Pick<HostedLoggingStorage, 'tenants'> | undefined, resume: TenantResume = unconnectedResume): GatewayParts {
  if (storage?.tenants === undefined) {
    throw new DeploymentConfigError('MCP_TENANTS_ENABLED=true needs the tenant registry: DATABASE_URL and LOGGING_DESTINATION_ENCRYPTION_KEY must be valid.');
  }
  const { lookup, requests, gateway } = storage.tenants;
  return { settings, tenants: gatewayTenantsOf({ lookup, requests, resumes: new TenantResumes(gateway, resume), activity: new TenantActivity(gateway) }) };
}

/** The registry port of the gateway, from the lookup copy, the tenant request, the resume, and the activity write. */
export function gatewayTenantsOf(registry: GatewayRegistry): GatewayTenants {
  return {
    find: (organizationId) => registry.lookup.find(organizationId),
    request: (organizationId) => registry.requests.request(organizationId),
    resume: (organizationId) => registry.resumes.resume(organizationId),
    recordActive: (organizationId) => { registry.activity.recordActive(organizationId); },
  };
}

/** The forward step of MCPServer: the gateway with the signer of the private key of the settings. */
export function gatewayForwardOf(parts: GatewayParts, logger: SystemLog): McpForwardStep {
  const gateway = new McpGateway({ signer: new AccessContextSigner(parts.settings.signingKey), tenants: parts.tenants, logger });
  return (request, forwarded) => gateway.forward(request, forwarded);
}

/** The context check of the relay route: the public key of the signing key, for the organization of each relay. */
export function relayContextCheckOf(verifyingKey: GatewaySettings['verifyingKey']): RelayContextCheck {
  return (context, organizationId) => new AccessContextVerifier({ publicKeys: [verifyingKey], organizationId }).verifyRelay(context);
}

/**
 * The route POST /internal/audit on the internal service host. The capture of today exports each relayed event. Each
 * refusal is one error line for the operator, because only a faulty or a compromised tenant sends one.
 */
export function auditRelayRouteOf(settings: GatewaySettings, parts: { readonly authority: string; readonly audit: Pick<AuditLog, 'relayedToolCompletion' | 'toolRelayed'>; readonly logger: SystemLog }): AuditRelayRoute {
  return new AuditRelayRoute({
    internalHost: new URL(settings.controlPlaneInternalUrl).host,
    authority: parts.authority,
    verify: relayContextCheckOf(settings.verifyingKey),
    audit: parts.audit,
    reportRefusal: (refusal) => parts.logger.error(`Audit relay refusal: ${JSON.stringify(refusal)}`),
  });
}
