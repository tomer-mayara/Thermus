import type { SystemLog } from '../../logs/system/system-logger.ts';
import { serviceChangeReason } from './service-change-reason.ts';
import type { FleetRow, TenantFleetStore } from './tenant-fleet-store.ts';
import type { TenantPlatform } from './tenant-platform.ts';
import type { SweepStep } from './tenant-sweeps.ts';

const DAY_MS = 86_400_000;

type RowResult = 'suspended' | 'moved' | 'failed';
type IdleRow = FleetRow & { readonly serviceId: string };

export interface IdleSweepParts {
  readonly store: Pick<TenantFleetStore, 'readIdle' | 'markSuspended'>;
  readonly platform: Pick<TenantPlatform, 'suspendService'>;
  /** The plan of a free tenant, TENANT_PLAN_FREE: a row of another plan is a team tenant, which is never suspended. */
  readonly freePlan: string;
  /** FREE_TENANT_IDLE_DAYS: the days without an MCP call after which a free tenant is suspended. */
  readonly idleDays: number;
  readonly log: SystemLog;
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
  private readonly parts: IdleSweepParts;

  constructor(parts: IdleSweepParts) {
    this.parts = parts;
  }

  runsAt(_tickMs: number): boolean {
    return true;
  }

  async run(tickMs: number, signal: AbortSignal): Promise<void> {
    const { store, freePlan, idleDays, log } = this.parts;
    const idle = await store.readIdle(freePlan, new Date(tickMs - idleDays * DAY_MS).toISOString());
    if (idle.status !== 'complete') {
      log.error(`Idle sweep stopped: ${JSON.stringify({ reason: 'The tenant registry cannot be read' })}`);
      return;
    }
    const counts: Record<'idle' | RowResult, number> = { idle: idle.rows.length, suspended: 0, moved: 0, failed: 0 };
    for (const row of idle.rows.filter(hasService)) {
      signal.throwIfAborted();
      counts[await this.suspend(row, signal)] += 1;
    }
    log.info(`Idle sweep: ${JSON.stringify(counts)}`);
  }

  private async suspend(row: IdleRow, signal: AbortSignal): Promise<RowResult> {
    const { organizationId, serviceId } = row;
    const change = await this.parts.platform.suspendService(serviceId, signal);
    if (change.status !== 'accepted') return this.failed(row, `The platform did not take the suspend: ${serviceChangeReason(change)}`);
    const marked = await this.parts.store.markSuspended(organizationId, serviceId);
    if (marked.status === 'unavailable') {
      return this.failed(row, `The platform suspended the tenant service ${serviceId}, but the tenant registry did not take the suspended state. The next sweep suspends it again.`);
    }
    if (marked.status === 'moved') {
      this.parts.log.info(`The idle sweep leaves organization ${organizationId}: its row changed during the suspension.`);
      return 'moved';
    }
    const record = { organizationId, state: 'suspended', from: 'live', serviceId, serviceName: row.serviceName, idleSince: row.lastActiveAt ?? row.createdAt, cause: 'idle' };
    this.parts.log.info(`Tenant suspension record: ${JSON.stringify(record)}`);
    return 'suspended';
  }

  private failed(row: IdleRow, reason: string): RowResult {
    this.parts.log.error(`Tenant suspension failed: ${JSON.stringify({ organizationId: row.organizationId, serviceId: row.serviceId, reason })}`);
    return 'failed';
  }
}

function hasService(row: FleetRow): row is IdleRow {
  return row.serviceId !== null;
}
