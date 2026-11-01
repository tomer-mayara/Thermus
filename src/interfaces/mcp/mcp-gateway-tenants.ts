// The tenant registry as the MCP gateway needs it. App composes this port on the tenants owner, so mcp imports no
// registry module.

export type GatewayTenantState = 'requested' | 'creating' | 'deploying' | 'live' | 'suspended' | 'failed' | 'deleted';

/** A found row has the time since its last change: for a live row, its live record or the digest record of an upgrade. */
export type GatewayRoute =
  | { readonly status: 'found'; readonly state: GatewayTenantState; readonly internalUrl: string | null; readonly sinceChangeMs: number }
  | { readonly status: 'absent' }
  | { readonly status: 'unavailable' };

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
