import { DeploymentConfigError } from './deployment-config.ts';

type Environment = Readonly<Record<string, string | undefined>>;

// The cap of the registry while MCP_TENANTS_ENABLED is off and the setting is not read (decision D-6).
export const DEFAULT_FREE_TENANT_LIMIT = 25;
const MAX_FREE_TENANT_LIMIT = 1000;

// With MCP_TENANTS_ENABLED on, the control plane reads FREE_TENANT_LIMIT at startup: the number of free tenants that
// can hold a place at the same time. 0 closes free signup through the cap. The error names the setting and its rule,
// but never the value.
export function loadFreeTenantLimit(environment: Environment): number {
  const limit = environment.FREE_TENANT_LIMIT;
  if (limit === undefined || limit === '') return DEFAULT_FREE_TENANT_LIMIT;
  if (!/^\d{1,4}$/.test(limit) || Number(limit) > MAX_FREE_TENANT_LIMIT) {
    throw new DeploymentConfigError(`FREE_TENANT_LIMIT must be a whole number from 0 to ${MAX_FREE_TENANT_LIMIT}.`);
  }
  return Number(limit);
}
