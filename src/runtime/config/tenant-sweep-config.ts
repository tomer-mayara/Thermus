import { DeploymentConfigError } from './deployment-config.ts';

type Environment = Readonly<Record<string, string | undefined>>;

// 04:00 UTC: after the evening in America and before the morning in Europe, so the summary of the night is ready early.
const DEFAULT_SWEEP_HOUR_UTC = 4;
const HOUR = /^(?:\d|1\d|2[0-3])$/;

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
