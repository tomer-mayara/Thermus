// The tenant registry as the MCP gateway needs it. App composes this port on the tenants owner, so mcp imports no
// registry module.

export type GatewayTenantState = 'requested' | 'creating' | 'deploying' | 'live' | 'suspended' | 'failed' | 'deleted';

/** The row of an organization in the registry copy: its state and its internal address, no row, or no usable copy. */
export type GatewayRoute =
  | { readonly status: 'found'; readonly state: GatewayTenantState; readonly internalUrl: string | null }
  | { readonly status: 'absent' }
  | { readonly status: 'unavailable' };

/** The tenant request for an organization without a row: requested, the cap is full, no registry, or a row exists. */
export type GatewayTenantRequest =
  | { readonly status: 'requested' | 'full' | 'unavailable' }
  | { readonly status: 'present'; readonly state: GatewayTenantState };

/** The resume of a suspended tenant: sent by this call, pending in another call, failed, or no registry write. */
export type GatewayResume = { readonly status: 'sent' | 'pending' | 'unavailable' } | { readonly status: 'failed'; readonly reason: string };

export interface GatewayTenants {
  find(organizationId: string): Promise<GatewayRoute>;
  request(organizationId: string): Promise<GatewayTenantRequest>;
  resume(organizationId: string): Promise<GatewayResume>;
  /** Called after each successful forward; the registry writes last_active_at at most one time a minute. */
  recordActive(organizationId: string): void;
}
