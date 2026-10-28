import type { SystemLog } from '../../logs/system/system-logger.ts';
import type { OrganizationInventory } from './organization-inventory.ts';
import type { FleetRow, RemovableState, TenantFleetStore } from './tenant-fleet-store.ts';
import type { TenantState } from './tenant-registry-store.ts';
import { removeTenant, type RemovalOutcome, type RemovalParts } from './tenant-removal.ts';
import type { SweepStep } from './tenant-sweeps.ts';

// The weekly sweep runs at the daily tick of Monday, in UTC.
const SWEEP_WEEKDAY = 1;
// The provisioner works on these rows: a service that it creates after a removal would stay without a row, so they wait.
const IN_FLIGHT: ReadonlySet<TenantState> = new Set(['creating', 'deploying']);
// The bound of the deletion authority (manager decision of 28 October 2026). A WorkOS key of another environment, or a
// defect of the list read, makes every organization absent and every read by ID a 404, so the sweep would delete the
// whole fleet in one tick. So an empty list, or more absent rows than this, stops the sweep: the operator checks and
// deletes by hand with the fleet script.
const ABSENT_LIMIT = 2;

type RowResult = 'deleted' | 'foundOnRead' | 'unreadable' | 'inFlight' | 'moved' | 'failed';
type SweptRow = FleetRow & { readonly state: RemovableState };
// The counts of a stop of the bound: the rows that are not deleted, the listed organizations, and the absent rows.
type Scope = { readonly rows: number; readonly organizations: number; readonly absent: number };

export interface OrganizationSweepParts extends RemovalParts {
  readonly store: Pick<TenantFleetStore, 'readFleet' | 'markDeleted'>;
  readonly inventory: Pick<OrganizationInventory, 'listOrganizations' | 'readOrganization'>;
  readonly log: SystemLog;
}

/**
 * The weekly organization sweep (plan section 4.2): it removes the tenant of each organization that the identity
 * provider no longer has, and the row becomes deleted. It compares the rows that are not deleted with the complete
 * organization list, then reads each left-out organization by its ID and removes the tenant only when that read says
 * that the organization does not exist, because the lists lag behind a delete for seconds (SO-01e, SO-01f). A list that
 * is not complete removes nothing, and neither does an empty list or one that leaves out more than ABSENT_LIMIT rows.
 * Each removed tenant gets one record line, and each sweep one line with its counts.
 */
export class OrganizationSweep implements SweepStep {
  readonly name = 'organization sweep';
  private readonly parts: OrganizationSweepParts;

  constructor(parts: OrganizationSweepParts) {
    this.parts = parts;
  }

  runsAt(tickMs: number): boolean {
    return new Date(tickMs).getUTCDay() === SWEEP_WEEKDAY;
  }

  async run(_tickMs: number, signal: AbortSignal): Promise<void> {
    const fleet = await this.parts.store.readFleet();
    if (fleet.status !== 'complete') return this.stopped('The tenant registry cannot be read');
    const rows = fleet.rows.filter(isSwept);
    const list = await this.parts.inventory.listOrganizations(signal);
    if (list.status !== 'complete') return this.stopped(`The organization list is not complete: ${list.reason}`);
    const absent = rows.filter((row) => !list.organizationIds.has(row.organizationId));
    const scope = { rows: rows.length, organizations: list.organizationIds.size, absent: absent.length };
    if (scope.organizations === 0) return this.stopped('The organization list is empty', scope);
    if (scope.absent > ABSENT_LIMIT) return this.stopped(`More than ${ABSENT_LIMIT} tenants have no organization in the list`, scope);
    const counts: Record<'rows' | 'organizations' | RowResult, number> = {
      rows: scope.rows, organizations: scope.organizations, deleted: 0, foundOnRead: 0, unreadable: 0, inFlight: 0, moved: 0, failed: 0,
    };
    for (const row of absent) counts[await this.sweepRow(row, signal)] += 1;
    this.parts.log.info(`Organization sweep: ${JSON.stringify(counts)}`);
  }

  private async sweepRow(row: SweptRow, signal: AbortSignal): Promise<RowResult> {
    if (IN_FLIGHT.has(row.state)) return 'inFlight';
    const read = await this.parts.inventory.readOrganization(row.organizationId, signal);
    if (read.status === 'present') return 'foundOnRead';
    if (read.status === 'unavailable') {
      this.parts.log.info(`The organization sweep keeps the tenant of organization ${row.organizationId}: its read by ID is unavailable (${read.reason}). The next sweep reads it again.`);
      return 'unreadable';
    }
    return this.removed(row, await removeTenant(this.parts, row, signal));
  }

  private removed(row: SweptRow, outcome: RemovalOutcome): RowResult {
    const { organizationId, serviceId, serviceName } = row;
    if (outcome.status === 'failed') {
      this.parts.log.error(`Tenant removal failed: ${JSON.stringify({ organizationId, serviceId, reason: outcome.reason })}`);
      return 'failed';
    }
    if (outcome.status === 'moved') {
      this.parts.log.info(`The organization sweep leaves organization ${organizationId}: its row changed during the removal. The next sweep removes it.`);
      return 'moved';
    }
    this.parts.log.info(`Tenant removal record: ${JSON.stringify({ organizationId, state: 'deleted', from: row.state, serviceId, serviceName, cause: 'organization-absent' })}`);
    return 'deleted';
  }

  // A stop before the comparison has no counts; a stop of the bound names them for the check of the operator.
  private stopped(reason: string, scope?: Scope): void {
    this.parts.log.error(`Organization sweep stopped: ${JSON.stringify({ reason, ...scope })}`);
  }
}

function isSwept(row: FleetRow): row is SweptRow {
  return row.state !== 'deleted';
}
