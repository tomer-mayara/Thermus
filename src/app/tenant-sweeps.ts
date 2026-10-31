import { WorkOSOrganizationInventory, type WorkOSInventoryClient } from '../accounts/providers/workos/workos-organization-inventory.ts';
import type { SystemLog } from '../logs/system/system-logger.ts';
import type { TenantProvisioningSettings } from '../runtime/config/mcp-tenants-config.ts';
import { FleetSummary, fleetSummaryStep } from '../tenancy/tenants/fleet-summary.ts';
import { OrganizationSweep } from '../tenancy/tenants/organization-sweep.ts';
import type { TenantFleetStore } from '../tenancy/tenants/tenant-fleet-store.ts';
import type { TenantPlatform } from '../tenancy/tenants/tenant-platform.ts';
import { TenantSweeps, type SweepClock } from '../tenancy/tenants/tenant-sweeps.ts';
import { wallClock } from './system-clock.ts';

export interface TenantSweepsParts {
  readonly settings: Pick<TenantProvisioningSettings, 'freePlan' | 'sweepHourUtc'>;
  // The platform adapter with the write guard of the registry.
  readonly platform: TenantPlatform;
  readonly fleet: TenantFleetStore;
  // The WorkOS client of the control plane, for the organization list and the memberships.
  readonly workos: WorkOSInventoryClient;
  readonly logger: SystemLog;
  // A seam of the tests. Production uses the wall clock of the process.
  readonly sweepClock?: SweepClock;
}

export interface TenantSweepsLifetime {
  /** Stops the sweeps and waits until the current step ends. */
  close(): Promise<void>;
}

/**
 * Starts the tenant sweeps of the control plane: each day at TENANT_SWEEP_HOUR_UTC, the organization sweep on Mondays,
 * then the fleet summary line. App owns their lifetime and closes them before the SQL runtime.
 */
export function startTenantSweeps(parts: TenantSweepsParts): TenantSweepsLifetime {
  const { settings, platform, fleet, logger } = parts;
  const inventory = new WorkOSOrganizationInventory(parts.workos);
  const sweep = new OrganizationSweep({ store: fleet, inventory, platform, log: logger });
  const summary = new FleetSummary({ store: fleet, platform, inventory, freePlan: settings.freePlan });
  const sweeps = new TenantSweeps({ steps: [sweep, fleetSummaryStep(summary, logger)], hourUtc: settings.sweepHourUtc, clock: parts.sweepClock ?? wallClock, log: logger });
  const controller = new AbortController();
  const running = sweeps.run(controller.signal);
  logger.info(`The tenant sweeps run each day at ${String(settings.sweepHourUtc).padStart(2, '0')}:00 UTC: the organization sweep on Mondays, then the fleet summary.`);
  // A second close aborts nothing more and waits for the same end of the sweeps.
  return { close: () => { controller.abort(new DOMException('The control plane is shutting down', 'AbortError')); return running; } };
}
