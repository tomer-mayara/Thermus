import type { SystemLog } from '../../logs/system/system-logger.ts';
import { costByStateAndPlan, type StatePlanCount } from './fleet-cost.ts';
import type { DefaultRoleMembership, OrganizationInventory } from './organization-inventory.ts';
import type { FleetRow, TenantFleetStore } from './tenant-fleet-store.ts';
import type { TenantPlatform, TimeWindow } from './tenant-platform.ts';
import type { SweepStep } from './tenant-sweeps.ts';

const WINDOW_HOURS = 24;
const HOUR_MS = 3_600_000;
// The line names the first default-role memberships; the count names them all.
const LISTED_LIMIT = 50;

/** The restarts outside a deploy of one live tenant, in the window. */
export interface ServiceRestarts {
  readonly organizationId: string;
  readonly serviceId: string;
  readonly restarts: number;
}

/** The memory of one live tenant in the window: its peak, its limit, and the share of the limit, with 3 decimals. */
export interface ServiceMemory {
  readonly organizationId: string;
  readonly serviceId: string;
  readonly peakBytes: number;
  readonly limitBytes: number | null;
  readonly peakShare: number | null;
}

/**
 * The daily fleet summary, the record of the line `Tenant fleet summary: <JSON>` (SO-09). The window is the 24 hours
 * before the tick. restarts counts the reads that answered, and unavailable names each read that did not, so a gap is
 * never a zero. The record names organizations, services, and memberships by ID only, never a person.
 */
export interface FleetSummaryRecord {
  readonly at: string;
  readonly windowHours: number;
  /** The rows that are not deleted. */
  readonly tenants: number;
  readonly monthlyUsd: number;
  readonly byState: readonly StatePlanCount[];
  readonly defaultRoleMemberships: number | null;
  readonly defaultRoleMembershipList: readonly DefaultRoleMembership[];
  readonly restarts: number;
  readonly restartList: readonly ServiceRestarts[];
  readonly highestMemoryShare: number | null;
  readonly memory: readonly ServiceMemory[];
  readonly unavailable: readonly string[];
}

export interface FleetSummaryParts {
  readonly store: Pick<TenantFleetStore, 'readFleet'>;
  readonly platform: Pick<TenantPlatform, 'memoryUse' | 'restartCount'>;
  readonly inventory: Pick<OrganizationInventory, 'defaultRoleMemberships'>;
  /** The plan of a free tenant, TENANT_PLAN_FREE. */
  readonly freePlan: string;
}

type LiveRow = FleetRow & { readonly serviceId: string };

// The platform reads of the window: what the reads that answered found, and one entry for each read that did not.
interface WindowReads<T> {
  readonly found: readonly T[];
  readonly unavailable: readonly string[];
}

/**
 * The fleet summary of the control plane and of the fleet script: the count and the cost of each state and plan (plan
 * section 8), the memberships with only the default role, which WorkOS bills as seats (plan section 7), and the
 * restarts and memory of each live tenant from the platform. It reads; it changes nothing.
 */
export class FleetSummary {
  private readonly parts: FleetSummaryParts;

  constructor(parts: FleetSummaryParts) {
    this.parts = parts;
  }

  /** The summary of the 24 hours before atMs, or undefined when the registry cannot be read. */
  async record(atMs: number, signal: AbortSignal): Promise<FleetSummaryRecord | undefined> {
    const fleet = await this.parts.store.readFleet();
    if (fleet.status !== 'complete') return undefined;
    const rows = fleet.rows.filter((row) => row.state !== 'deleted');
    const live = rows.filter(isLiveService);
    const window = { startMs: atMs - WINDOW_HOURS * HOUR_MS, endMs: atMs };
    const memory = await this.memoryOf(live, window, signal);
    const restarts = await this.restartsOf(live, window, signal);
    const seats = await this.parts.inventory.defaultRoleMemberships(signal);
    const byState = costByStateAndPlan(rows, this.parts.freePlan);
    return {
      at: new Date(atMs).toISOString(), windowHours: WINDOW_HOURS, tenants: rows.length,
      monthlyUsd: byState.reduce((total, group) => total + group.monthlyUsd, 0), byState,
      defaultRoleMemberships: seats.status === 'complete' ? seats.memberships.length : null,
      defaultRoleMembershipList: seats.status === 'complete' ? seats.memberships.slice(0, LISTED_LIMIT) : [],
      restarts: restarts.found.reduce((total, service) => total + service.restarts, 0), restartList: restarts.found.filter((service) => service.restarts > 0),
      highestMemoryShare: highestShareOf(memory.found), memory: memory.found,
      unavailable: [...memory.unavailable, ...restarts.unavailable, ...(seats.status === 'unavailable' ? [`default-role memberships: ${seats.reason}`] : [])],
    };
  }

  private async memoryOf(live: readonly LiveRow[], window: TimeWindow, signal: AbortSignal): Promise<WindowReads<ServiceMemory>> {
    if (live.length === 0) return { found: [], unavailable: [] };
    const read = await this.parts.platform.memoryUse(live.map(({ serviceId }) => serviceId), window, signal);
    if (read.status === 'unavailable') return { found: [], unavailable: [`memory: ${read.reason}`] };
    const found = live.flatMap(({ organizationId, serviceId }) => {
      const use = read.services.get(serviceId);
      if (use === undefined) return [];
      const limitBytes = use.limitBytes ?? null;
      return [{ organizationId, serviceId, peakBytes: use.peakBytes, limitBytes, peakShare: limitBytes === null ? null : Math.round((use.peakBytes / limitBytes) * 1_000) / 1_000 }];
    });
    return { found, unavailable: [] };
  }

  private async restartsOf(live: readonly LiveRow[], window: TimeWindow, signal: AbortSignal): Promise<WindowReads<ServiceRestarts>> {
    const found: ServiceRestarts[] = [];
    const unavailable: string[] = [];
    for (const { organizationId, serviceId } of live) {
      const read = await this.parts.platform.restartCount(serviceId, window, signal);
      if (read.status === 'found') found.push({ organizationId, serviceId, restarts: read.restarts });
      else unavailable.push(`restarts of ${serviceId}: ${read.status === 'gone' ? 'the tenant service no longer exists' : read.reason}`);
    }
    return { found, unavailable };
  }
}

/** The line of the record in the system log, which the Axiom monitors of SO-11 read. */
export function fleetSummaryLine(record: FleetSummaryRecord): string {
  return `Tenant fleet summary: ${JSON.stringify(record)}`;
}

/** The daily step of the tenant sweeps: one summary line each day, or one stop line without the registry. */
export function fleetSummaryStep(summary: FleetSummary, log: SystemLog): SweepStep {
  return {
    name: 'fleet summary',
    runsAt: () => true,
    run: async (tickMs, signal) => {
      const record = await summary.record(tickMs, signal);
      if (record === undefined) log.error(`Tenant fleet summary stopped: ${JSON.stringify({ reason: 'The tenant registry cannot be read' })}`);
      else log.info(fleetSummaryLine(record));
    },
  };
}

function isLiveService(row: FleetRow): row is LiveRow {
  return row.state === 'live' && row.serviceId !== null;
}

function highestShareOf(memory: readonly ServiceMemory[]): number | null {
  const shares = memory.map(({ peakShare }) => peakShare).filter((share) => share !== null);
  return shares.length === 0 ? null : Math.max(...shares);
}
