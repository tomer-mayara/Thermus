import { WorkOSOrganizationInventory, type WorkOSInventoryClient } from '../accounts/providers/workos/workos-organization-inventory.ts';
import type { SystemLog } from '../logs/system/system-logger.ts';
import type { TenantProvisioningSettings } from '../runtime/config/mcp-tenants-config.ts';
import { FinishingPlatform, type LoopPlatform } from '../tenancy/tenants/finishing-platform.ts';
import { FleetSummary, fleetSummaryStep } from '../tenancy/tenants/fleet-summary.ts';
import { IdleSweep } from '../tenancy/tenants/idle-sweep.ts';
import { OrganizationSweep } from '../tenancy/tenants/organization-sweep.ts';
import type { TenantFleetStore } from '../tenancy/tenants/tenant-fleet-store.ts';
import type { TenantPlatform } from '../tenancy/tenants/tenant-platform.ts';
import { TenantSweeps, type SweepClock } from '../tenancy/tenants/tenant-sweeps.ts';
import { wallClock } from './system-clock.ts';
import { startTenantLoop } from './tenant-loop.ts';

export interface TenantSweepsParts {
  readonly settings: Pick<TenantProvisioningSettings, 'freePlan' | 'sweepHourUtc' | 'freeTenantIdleDays'>;
  // The platform adapter with the write guard of the registry.
  readonly platform: TenantPlatform;
  readonly fleet: TenantFleetStore;
  // The WorkOS client of the control plane, for the organization list and the memberships.
  readonly workos: WorkOSInventoryClient;
  readonly logger: SystemLog;
  // A seam of the tests. Production uses the wall clock of the process.
  readonly sweepClock?: SweepClock;
  // A seam of the tests: the grace of the platform call in flight after the stop. Production waits 3 s.
  readonly inFlightGraceMs?: number;
}

export interface TenantSweepsLifetime {
  /** Stops the sweeps: no new step, row, or Render call after the stop, and the call in flight gets a grace of 3 s. */
  close(): Promise<void>;
}

/**
 * Starts the tenant sweeps of the control plane: each day at TENANT_SWEEP_HOUR_UTC, the organization sweep on Mondays,
 * then the idle sweep of the free tenants, then the fleet summary line, which so counts the tenants that the idle sweep
 * suspended. App owns their lifetime and closes them before the SQL runtime. A suspend or delete in flight at the stop
 * ends, so its mark reaches the registry.
 */
export function startTenantSweeps(parts: TenantSweepsParts): TenantSweepsLifetime {
  const { settings, logger } = parts;
  const lifetime = startTenantLoop(({ stop, inFlight }) => sweepsOf(parts, new FinishingPlatform(parts.platform, inFlight)).run(stop), parts.inFlightGraceMs);
  logger.info(`The tenant sweeps run each day at ${String(settings.sweepHourUtc).padStart(2, '0')}:00 UTC: the organization sweep on Mondays, the idle sweep of the free tenants after ${settings.freeTenantIdleDays} days without a call, then the fleet summary.`);
  return lifetime;
}

function sweepsOf(parts: TenantSweepsParts, platform: LoopPlatform): TenantSweeps {
  const { settings, fleet, logger } = parts;
  const inventory = new WorkOSOrganizationInventory(parts.workos);
  const sweep = new OrganizationSweep({ store: fleet, inventory, platform, log: logger });
  const idle = new IdleSweep({ store: fleet, platform, freePlan: settings.freePlan, idleDays: settings.freeTenantIdleDays, log: logger });
  const summary = new FleetSummary({ store: fleet, platform, inventory, freePlan: settings.freePlan });
  const steps = [sweep, idle, fleetSummaryStep(summary, logger)];
  return new TenantSweeps({ steps, hourUtc: settings.sweepHourUtc, clock: parts.sweepClock ?? wallClock, log: logger });
}
