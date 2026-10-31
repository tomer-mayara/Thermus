import { DeploymentConfigError } from './deployment-config.ts';

type Environment = Readonly<Record<string, string | undefined>>;

// 04:00 UTC: after the evening in America and before the morning in Europe, so the summary of the night is ready early.
const DEFAULT_SWEEP_HOUR_UTC = 4;
const HOUR = /^(?:\d|1\d|2[0-3])$/;
// Decision D-6: a free tenant without an MCP call for 14 days is suspended. App gives the default to the notice of
// the portal when the control plane reads no tenant setting.
export const DEFAULT_FREE_TENANT_IDLE_DAYS = 14;
// A whole number from 1 to 365, without a leading zero.
const IDLE_DAYS = /^(?:[1-9]\d?|[12]\d\d|3[0-5]\d|36[0-5])$/;

/**
 * The hour in UTC of the daily tick of the tenant sweeps, TENANT_SWEEP_HOUR_UTC. The control plane reads it only with
 * MCP_TENANTS_ENABLED=true. The error names the setting and its rule, but never the value.
 */
export function loadTenantSweepHour(environment: Environment): number {
  const hour = environment.TENANT_SWEEP_HOUR_UTC;
  if (hour === undefined || hour === '') return DEFAULT_SWEEP_HOUR_UTC;
  if (!HOUR.test(hour)) throw new DeploymentConfigError('TENANT_SWEEP_HOUR_UTC must be a whole number from 0 to 23.');
  return Number(hour);
}

/**
 * The days without an MCP call after which the idle sweep suspends a free tenant, FREE_TENANT_IDLE_DAYS. The control
 * plane reads it only with MCP_TENANTS_ENABLED=true. The error names the setting and its rule, but never the value.
 */
export function loadFreeTenantIdleDays(environment: Environment): number {
  const days = environment.FREE_TENANT_IDLE_DAYS;
  if (days === undefined || days === '') return DEFAULT_FREE_TENANT_IDLE_DAYS;
  if (!IDLE_DAYS.test(days)) throw new DeploymentConfigError('FREE_TENANT_IDLE_DAYS must be a whole number from 1 to 365.');
  return Number(days);
}
