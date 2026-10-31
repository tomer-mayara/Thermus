import type { FleetRead, FleetRow, FleetWrite, RemovableState, ReviveResult, TenantFleetStore } from '../../../../src/tenancy/tenants/tenant-fleet-store.ts';
import type { RegistryCount, TenantState } from '../../../../src/tenancy/tenants/tenant-registry-store.ts';
import { TenantProvisioningStoreFake, type FakeTenantRow } from './tenant-provisioning-store-fake.ts';

export type FleetOperation = 'read' | 'deleted' | 'revive' | 'suspended' | 'resumed' | 'digest';

const CREATED_AT = '2026-10-01T08:00:00.000Z';

/**
 * The registry fake of the provisioner (a fake) with the statements of the fleet commands and the sweeps. Each change
 * names the state and the service that it starts from, as the guarded updates of the SQL adapter do; changes lists each
 * state that a row takes, in order. An operation in fleetUnavailable stands in for a storage failure of that operation, and
 * beforeChange runs before each change, so a test can play another writer at that moment.
 */
export class TenantFleetStoreFake extends TenantProvisioningStoreFake implements TenantFleetStore {
  readonly fleetUnavailable = new Set<FleetOperation>();
  beforeChange: (operation: FleetOperation, organizationId: string) => void = () => {};

  async readFleet(): Promise<FleetRead> {
    if (this.fleetUnavailable.has('read')) return { status: 'unavailable' };
    return { status: 'complete', rows: [...this.rows.values()].map(fleetRowOf) };
  }

  async markDeleted(organizationId: string, from: RemovableState, serviceId: string | null): Promise<FleetWrite> {
    return this.fleetMove('deleted', { organizationId, from: [from], serviceId }, (row) => {
      this.moveTo(row, 'deleted');
      row.internalUrl = null;
    });
  }

  async reviveDeleted(organizationId: string, admit: (count: RegistryCount) => boolean): Promise<ReviveResult> {
    if (this.fleetUnavailable.has('revive')) return { status: 'unavailable' };
    const count = this.countFor(organizationId);
    if (!admit(count)) return { status: 'refused', count };
    const row = this.row(organizationId);
    this.moveTo(row, 'requested');
    Object.assign(row, { serviceName: null, serviceId: null, internalUrl: null, imageDigest: null, plan: null, appliedPlan: null, failureReason: null });
    return { status: 'revived' };
  }

  async markSuspended(organizationId: string, serviceId: string): Promise<FleetWrite> {
    return this.fleetMove('suspended', { organizationId, from: ['live'], serviceId }, (row) => this.moveTo(row, 'suspended'));
  }

  async markResumed(organizationId: string, serviceId: string): Promise<FleetWrite> {
    return this.fleetMove('resumed', { organizationId, from: ['suspended'], serviceId }, (row) => this.moveTo(row, 'deploying'));
  }

  async recordDigest(organizationId: string, serviceId: string, imageDigest: string): Promise<FleetWrite> {
    return this.fleetMove('digest', { organizationId, from: ['live'], serviceId }, (row) => { row.imageDigest = imageDigest; });
  }

  /** The state of the row of the organization, or undefined without a row. */
  stateOf(organizationId: string): TenantState | undefined {
    return this.rows.get(organizationId)?.state;
  }

  // A change applies only to a row in one of its start states and on the service that the caller read.
  private fleetMove(operation: FleetOperation, start: { readonly organizationId: string; readonly from: readonly TenantState[]; readonly serviceId: string | null }, apply: (row: FakeTenantRow) => void): FleetWrite {
    this.beforeChange(operation, start.organizationId);
    if (this.fleetUnavailable.has(operation)) return { status: 'unavailable' };
    const row = this.rows.get(start.organizationId);
    if (row === undefined || !start.from.includes(row.state) || row.serviceId !== start.serviceId) return { status: 'moved' };
    apply(row);
    return { status: 'recorded' };
  }

  private moveTo(row: FakeTenantRow, state: TenantState): void {
    row.state = state;
    row.updatedAt += 1_000;
    this.changes.push(`${row.organizationId} ${state}`);
  }

  private countFor(organizationId: string): RegistryCount {
    const rowsByState = new Map<TenantState, number>();
    for (const { state } of this.rows.values()) rowsByState.set(state, (rowsByState.get(state) ?? 0) + 1);
    const current = this.rows.get(organizationId)?.state;
    return current === undefined ? { rowsByState } : { current, rowsByState };
  }
}

function fleetRowOf(row: FakeTenantRow): FleetRow {
  return {
    organizationId: row.organizationId, state: row.state, plan: row.plan, appliedPlan: row.appliedPlan, serviceId: row.serviceId,
    serviceName: row.serviceName, internalUrl: row.internalUrl, imageDigest: row.imageDigest, failureReason: row.failureReason,
    lastActiveAt: null, createdAt: CREATED_AT, updatedAt: new Date(Date.parse(CREATED_AT) + row.updatedAt * 1_000).toISOString(),
  };
}
