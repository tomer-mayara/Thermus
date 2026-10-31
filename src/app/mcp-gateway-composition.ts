import { AccessContextSigner } from '../accounts/identity/access-context-signer.ts';
import { AccessContextVerifier } from '../accounts/identity/access-context-verifier.ts';
import type { SystemLog } from '../logs/system/system-logger.ts';
import type { AuditLog } from '../logs/audit/audit-log.ts';
import { McpGateway } from '../interfaces/mcp/mcp-gateway.ts';
import type { GatewayTenants } from '../interfaces/mcp/mcp-gateway-tenants.ts';
import type { McpForwardStep } from '../interfaces/mcp/mcp-server.ts';
import type { RelayContextCheck } from '../interfaces/web/internal/audit-relay-check.ts';
import { AuditRelayRoute } from '../interfaces/web/internal/audit-relay-route.ts';
import { DeploymentConfigError } from '../runtime/config/deployment-config.ts';
import { DEFAULT_FREE_TENANT_LIMIT, loadFreeTenantLimit } from '../runtime/config/free-tenant-limit-config.ts';
import { loadGatewaySettings, requireSigningKeyIn, type GatewaySettings } from '../runtime/config/gateway-settings.ts';
import { loadMcpTenantsEnabled } from '../runtime/config/mcp-tenants-config.ts';
import { TenantActivity } from '../tenancy/tenants/tenant-activity.ts';
import type { TenantLookup } from '../tenancy/tenants/tenant-lookup.ts';
import type { TenantRequests } from '../tenancy/tenants/tenant-requests.ts';
import type { TenantResume } from '../tenancy/tenants/tenant-resume.ts';
import { TenantResumes } from '../tenancy/tenants/tenant-resumes.ts';
import type { HostedLoggingStorage } from './logging-storage.ts';

export interface GatewayParts {
  readonly settings: GatewaySettings;
  readonly tenants: GatewayTenants;
}

interface TenantsSettings {
  readonly freeTenantLimit: number;
  readonly gateway: GatewaySettings;
}

export interface GatewayStart {
  readonly freeTenantLimit: number;
  /**
   * Stops the start unless GATEWAY_PUBLIC_KEY of the provisioning settings, which each new tenant gets, holds the public
   * key of GATEWAY_SIGNING_KEY. With the switch off, it checks nothing.
   */
  requireSigningKeyIn(gatewayPublicKey: string | undefined): void;
  partsOn(storage: Pick<HostedLoggingStorage, 'tenants'> | undefined): GatewayParts | undefined;
}

export interface GatewayRoutes {
  readonly forward: McpForwardStep;
  readonly internalRoutes: AuditRelayRoute;
}

export interface GatewayRegistry {
  readonly lookup: Pick<TenantLookup, 'find'>;
  readonly requests: Pick<TenantRequests, 'request'>;
  readonly resumes: Pick<TenantResumes, 'resume'>;
  readonly activity: Pick<TenantActivity, 'recordActive'>;
}

/** The gateway of a start: the settings first, so an invalid setting stops the start before the server listens. */
export function gatewayStartOf(environment: Readonly<Record<string, string | undefined>>): GatewayStart {
  const settings = tenantsSettingsOf(environment);
  if (settings === undefined) return { freeTenantLimit: DEFAULT_FREE_TENANT_LIMIT, requireSigningKeyIn: () => undefined, partsOn: () => undefined };
  return {
    freeTenantLimit: settings.freeTenantLimit,
    requireSigningKeyIn: (gatewayPublicKey) => { requireSigningKeyIn(settings.gateway, gatewayPublicKey ?? ''); },
    partsOn: (storage) => gatewayPartsOf(settings.gateway, storage),
  };
}

/**
 * With MCP_TENANTS_ENABLED off, the control plane reads none of the settings of the tenants, and the registry keeps
 * its default cap. An invalid setting stops the start before the server listens; FREE_TENANT_LIMIT comes first.
 */
function tenantsSettingsOf(environment: Readonly<Record<string, string | undefined>>): TenantsSettings | undefined {
  if (!loadMcpTenantsEnabled(environment)) return undefined;
  return { freeTenantLimit: loadFreeTenantLimit(environment), gateway: loadGatewaySettings(environment) };
}

export function gatewayRoutesOf(parts: GatewayParts, composition: { readonly authority: string; readonly audit: Pick<AuditLog, 'relayedToolCompletion' | 'toolRelayed'>; readonly logger: SystemLog }): GatewayRoutes {
  return { forward: gatewayForwardOf(parts, composition.logger), internalRoutes: auditRelayRouteOf(parts.settings, composition) };
}

/**
 * The resume operation until SO-10 connects it to the Render API: each call fails with one log line, and the row goes
 * back to suspended. No tenant is suspended before the idle sweep of SO-10 runs.
 */
const unconnectedResume: TenantResume = {
  resume: async () => ({ status: 'failed', reason: 'The resume operation is not connected yet (SO-10).' }),
};

function gatewayPartsOf(settings: GatewaySettings, storage: Pick<HostedLoggingStorage, 'tenants'> | undefined, resume: TenantResume = unconnectedResume): GatewayParts {
  if (storage?.tenants === undefined) {
    throw new DeploymentConfigError('MCP_TENANTS_ENABLED=true needs the tenant registry: DATABASE_URL and LOGGING_DESTINATION_ENCRYPTION_KEY must be valid.');
  }
  const { lookup, requests, gateway } = storage.tenants;
  return { settings, tenants: gatewayTenantsOf({ lookup, requests, resumes: new TenantResumes(gateway, resume), activity: new TenantActivity(gateway) }) };
}

export function gatewayTenantsOf(registry: GatewayRegistry): GatewayTenants {
  return {
    find: (organizationId) => registry.lookup.find(organizationId),
    request: (organizationId) => registry.requests.request(organizationId),
    resume: (organizationId) => registry.resumes.resume(organizationId),
    recordActive: (organizationId) => { registry.activity.recordActive(organizationId); },
  };
}

function gatewayForwardOf(parts: GatewayParts, logger: SystemLog): McpForwardStep {
  const gateway = new McpGateway({ signer: new AccessContextSigner(parts.settings.signingKey), tenants: parts.tenants, logger });
  return (request, forwarded) => gateway.forward(request, forwarded);
}

export function relayContextCheckOf(verifyingKey: GatewaySettings['verifyingKey']): RelayContextCheck {
  return (context, organizationId) => new AccessContextVerifier({ publicKeys: [verifyingKey], organizationId }).verifyRelay(context);
}

/**
 * The route POST /internal/audit on the internal service host. The capture of today exports each relayed event. Each
 * refusal is one error line for the operator, because only a faulty or a compromised tenant sends one.
 */
function auditRelayRouteOf(settings: GatewaySettings, parts: { readonly authority: string; readonly audit: Pick<AuditLog, 'relayedToolCompletion' | 'toolRelayed'>; readonly logger: SystemLog }): AuditRelayRoute {
  return new AuditRelayRoute({
    internalHost: new URL(settings.controlPlaneInternalUrl).host,
    authority: parts.authority,
    verify: relayContextCheckOf(settings.verifyingKey),
    audit: parts.audit,
    reportRefusal: (refusal) => parts.logger.error(`Audit relay refusal: ${JSON.stringify(refusal)}`),
  });
}
