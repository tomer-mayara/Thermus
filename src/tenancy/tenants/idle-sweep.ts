import type { SystemLog } from '../../logs/system/system-logger.ts';
import { IdleSweepLog, type IdleCounts, type IdleRow } from './idle-sweep-log.ts';
import { serviceChangeReason } from './service-change-reason.ts';
import type { FleetRow, FleetWrite, TenantFleetStore } from './tenant-fleet-store.ts';
import type { TenantPlatform } from './tenant-platform.ts';
import type { SweepStep } from './tenant-sweeps.ts';

const DAY_MS = 86_400_000;

type RowResult = 'suspended' | 'moved' | 'failed';

export interface IdleSweepParts {
  readonly store: Pick<TenantFleetStore, 'readIdle' | 'markSuspended'>;
  readonly platform: Pick<TenantPlatform, 'suspendService'>;
  /** The plan of a free tenant, TENANT_PLAN_FREE: a row of another plan is a team tenant, which is never suspended. */
  readonly freePlan: string;
  /** FREE_TENANT_IDLE_DAYS: the days without an MCP call after which a free tenant is suspended. */
  readonly idleDays: number;
  readonly log: SystemLog;
}

// The parts of one sweep with its operator lines.
interface Suspension {
  readonly parts: IdleSweepParts;
  readonly lines: IdleSweepLog;
}

/**
 * The daily idle sweep (plan section 4.2, decision D-6): it suspends each live free tenant whose last MCP call is
 * idleDays or more before the tick, or whose creation is, when it never served a call. The gateway writes the last use
 * at most one time a minute (SO-05), so the period is exact to the minute. The platform suspends the service first, and
 * then the row moves from live to suspended on the service that the sweep read, so a row that another writer changed
 * stays as it is. A suspend that the platform does not take, also a 429, changes no row and gives one line; the next
 * sweep tries again (answer 4 of 27 October 2026). Each suspended tenant gets one record line, and each sweep one line
 * with its counts.
 */
export class IdleSweep implements SweepStep {
  readonly name = 'idle sweep';
  private readonly suspension: Suspension;

  constructor(parts: IdleSweepParts) {
    this.suspension = { parts, lines: new IdleSweepLog(parts.log) };
  }

  // Each day: a tick that falls while the control plane is down waits until the next day.
  runsAt(_tickMs: number): boolean {
    return true;
  }

  async run(tickMs: number, signal: AbortSignal): Promise<void> {
    const { parts, lines } = this.suspension;
    const idle = await parts.store.readIdle(parts.freePlan, new Date(tickMs - parts.idleDays * DAY_MS).toISOString());
    if (idle.status !== 'complete') return lines.stopped();
    lines.counts(await suspendAll(this.suspension, idle.rows, signal));
  }
}

const MARK_RESULTS: Readonly<Record<FleetWrite['status'], RowResult>> = { recorded: 'suspended', moved: 'moved', unavailable: 'failed' };

// Each idle row in turn. A stop of the control plane ends the sweep between two rows, with no count line.
async function suspendAll(suspension: Suspension, rows: readonly FleetRow[], signal: AbortSignal): Promise<IdleCounts> {
  const counts = { idle: rows.length, suspended: 0, moved: 0, failed: 0 };
  for (const row of rows.filter(hasService)) {
    signal.throwIfAborted();
    counts[await suspendRow(suspension, row, signal)] += 1;
  }
  return counts;
}

// The platform first: a refused or limited suspend changes no row.
async function suspendRow({ parts, lines }: Suspension, row: IdleRow, signal: AbortSignal): Promise<RowResult> {
  const change = await parts.platform.suspendService(row.serviceId, signal);
  if (change.status === 'accepted') return resultOfMark(lines, row, await parts.store.markSuspended(row.organizationId, row.serviceId));
  lines.failed(row, `The platform did not take the suspend: ${serviceChangeReason(change)}`);
  return 'failed';
}

// The mark names the state and the service that the sweep read, so a row of another writer is moved.
function resultOfMark(lines: IdleSweepLog, row: IdleRow, mark: FleetWrite): RowResult {
  if (mark.status === 'recorded') lines.suspended(row);
  else if (mark.status === 'moved') lines.left(row);
  else lines.failed(row, `The platform suspended the tenant service ${row.serviceId}, but the tenant registry did not take the suspended state. The next sweep suspends it again.`);
  return MARK_RESULTS[mark.status];
}

// The idle query reads only rows with a service; the guard gives the suspend call its service ID without a cast.
function hasService(row: FleetRow): row is IdleRow {
  return row.serviceId !== null;
}
