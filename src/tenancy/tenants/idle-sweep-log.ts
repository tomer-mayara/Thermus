import type { SystemLog } from '../../logs/system/system-logger.ts';
import type { FleetRow } from './tenant-fleet-store.ts';

/** A row that the idle sweep suspends: a live row with its service. */
export type IdleRow = FleetRow & { readonly serviceId: string };

/** The counts of one idle sweep. */
export interface IdleCounts {
  readonly idle: number;
  readonly suspended: number;
  readonly moved: number;
  readonly failed: number;
}

/**
 * The lines that the operator gets from the idle sweep, one line each, as the removal lines of the organization sweep
 * are. A record line is JSON, so a monitor can read it; a failure is one ERROR line, which the alerts of SO-11 can
 * watch. No line holds a key.
 */
export class IdleSweepLog {
  private readonly log: SystemLog;

  constructor(log: SystemLog) {
    this.log = log;
  }

  /** The registry could not be read, so the sweep suspended nothing. */
  stopped(): void {
    this.log.error(`Idle sweep stopped: ${JSON.stringify({ reason: 'The tenant registry cannot be read' })}`);
  }

  /** The record of a suspended tenant. A tenant that never served a call is idle since its creation. */
  suspended(row: IdleRow): void {
    const { organizationId, serviceId, serviceName } = row;
    const record = { organizationId, state: 'suspended', from: 'live', serviceId, serviceName, idleSince: row.lastActiveAt ?? row.createdAt, cause: 'idle' };
    this.log.info(`Tenant suspension record: ${JSON.stringify(record)}`);
  }

  /** The suspension of one tenant failed; the next sweep tries again. */
  failed(row: IdleRow, reason: string): void {
    this.log.error(`Tenant suspension failed: ${JSON.stringify({ organizationId: row.organizationId, serviceId: row.serviceId, reason })}`);
  }

  /** Another writer changed the row during the suspension, so the sweep leaves it. */
  left(row: IdleRow): void {
    this.log.info(`The idle sweep leaves organization ${row.organizationId}: its row changed during the suspension.`);
  }

  /** The line of each sweep with its counts. */
  counts(counts: IdleCounts): void {
    this.log.info(`Idle sweep: ${JSON.stringify(counts)}`);
  }
}
