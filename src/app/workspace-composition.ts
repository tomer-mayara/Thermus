import type { SystemLog } from '../logs/system/system-logger.ts';
import type { GatewayTenants } from '../interfaces/mcp/mcp-gateway-tenants.ts';
import type { SignupTenants } from '../interfaces/web/auth/workos/workos-signup-tenants.ts';
import { WorkspaceStatuses, type WorkspaceState, type WorkspaceTenants } from '../interfaces/web/account/workspace-status.ts';
import type { TenantLookup } from '../tenancy/tenants/tenant-lookup.ts';
import type { TenantRequests } from '../tenancy/tenants/tenant-requests.ts';
import type { GatewayParts } from './mcp-gateway-composition.ts';

/** The registry rules of the tenants owner that signup uses: the lookup copy and the tenant request with the cap. */
export interface SignupRegistry {
  readonly lookup: Pick<TenantLookup, 'countByState'>;
  readonly requests: Pick<TenantRequests, 'hasPlaceIn' | 'request'>;
}

/** The parts of signup and of the portal that follow the tenant of an organization (SO-07). */
export interface WorkspaceParts {
  readonly statuses: WorkspaceStatuses;
  // Absent without the tenant registry: then signup checks no cap and requests no tenant.
  readonly signup?: SignupTenants;
}

/** With MCP_TENANTS_ENABLED off, the control plane serves the tools of each organization itself, so each workspace is live. */
export const servedByControlPlane: WorkspaceTenants = { stateOf: async () => 'live' };

/**
 * The workspace state of an organization from the registry port of the gateway: the row of the registry copy, else
 * the tenant request inside the cap, the same request path as the gateway. The account routes checked access before.
 */
export function workspaceTenantsOf(tenants: Pick<GatewayTenants, 'find' | 'request'>): WorkspaceTenants {
  return {
    stateOf: async (organizationId): Promise<WorkspaceState> => {
      const route = await tenants.find(organizationId);
      if (route.status !== 'absent') return route.status === 'found' ? route.state : 'unavailable';
      const request = await tenants.request(organizationId);
      return request.status === 'present' ? request.state : request.status;
    },
  };
}

/**
 * The tenant port of signup. FREE_TENANT_LIMIT bounds the tenant containers and is read only with MCP_TENANTS_ENABLED
 * on, so only then does signup check the cap, on the registry copy. With the switch off, signup only inserts the
 * requested row (plan section 4.1).
 */
export function signupTenantsOf(registry: SignupRegistry, capped: boolean): SignupTenants {
  return {
    place: async () => {
      if (!capped) return 'open';
      const counted = await registry.lookup.countByState();
      if (counted.status !== 'counted') return 'unavailable';
      return registry.requests.hasPlaceIn(counted.rowsByState) ? 'open' : 'full';
    },
    request: async (organizationId) => (await registry.requests.request(organizationId)).status,
  };
}

/** The workspace parts of the hosted composition: the gateway parts mean MCP_TENANTS_ENABLED on. */
export function workspacePartsOf(parts: { readonly gateway?: Pick<GatewayParts, 'tenants'>; readonly storage?: { readonly tenants?: SignupRegistry }; readonly logger: SystemLog }): WorkspaceParts {
  const tenants = parts.gateway === undefined ? servedByControlPlane : workspaceTenantsOf(parts.gateway.tenants);
  const registry = parts.storage?.tenants;
  return {
    statuses: new WorkspaceStatuses(tenants, (line) => parts.logger.error(line)),
    ...(registry === undefined ? {} : { signup: signupTenantsOf(registry, parts.gateway !== undefined) }),
  };
}
