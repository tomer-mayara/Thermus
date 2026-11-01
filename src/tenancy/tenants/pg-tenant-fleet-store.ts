import type { BoundedSqlRuntime } from '../../runtime/sql/bounded-sql-runtime.ts';
import { COUNT_ROWS, LOCK_REGISTRY, registryCount } from './pg-tenant-registry-store.ts';
import type { FleetRead, FleetRow, FleetWrite, RemovableState, ReviveResult, TenantFleetStore, TickClaim } from './tenant-fleet-store.ts';
import type { RegistryCount, TenantState } from './tenant-registry-store.ts';

const FLEET_COLUMNS = `organization_id, state, plan, applied_plan, render_service_id, service_name, internal_url, image_digest,
  failure_reason, last_active_at, created_at, updated_at`;
const READ_FLEET = `SELECT ${FLEET_COLUMNS} FROM thermus_admin.tenants ORDER BY organization_id`;
// A row that never served a call has no last use, so its creation counts (plan section 4.2).
const READ_IDLE = `SELECT ${FLEET_COLUMNS} FROM thermus_admin.tenants
  WHERE state = 'live' AND render_service_id IS NOT NULL AND plan = $1 AND COALESCE(last_active_at, created_at) <= $2::timestamptz
  ORDER BY organization_id`;
// Each change names the state and the service that it starts from, so a row that another writer changed stays as it is.
// A replacement row of the same organization has a new service, so a stale change moves instead of changing it. A row
// without a service binds to NULL.
const MARK_DELETED = `UPDATE thermus_admin.tenants SET state = 'deleted', internal_url = NULL, updated_at = now()
  WHERE organization_id = $1 AND state = $2 AND state <> 'deleted' AND render_service_id IS NOT DISTINCT FROM $3 RETURNING organization_id`;
const MARK_SUSPENDED = `UPDATE thermus_admin.tenants SET state = 'suspended', updated_at = now()
  WHERE organization_id = $1 AND state = 'live' AND render_service_id = $2 RETURNING organization_id`;
const MARK_RESUMED = `UPDATE thermus_admin.tenants SET state = 'deploying', updated_at = now()
  WHERE organization_id = $1 AND state = 'suspended' AND render_service_id = $2 RETURNING organization_id`;
const RECORD_DIGEST = `UPDATE thermus_admin.tenants SET image_digest = $3, updated_at = now()
  WHERE organization_id = $1 AND render_service_id = $2 AND state = 'live' RETURNING organization_id`;
// A revived row is a new request: the provisioner names it again at its claim and creates a new service.
const REVIVE_DELETED = `UPDATE thermus_admin.tenants SET state = 'requested', render_service_id = NULL, service_name = NULL, internal_url = NULL,
  plan = NULL, applied_plan = NULL, image_digest = NULL, last_active_at = NULL, failure_reason = NULL, created_at = now(), updated_at = now()
  WHERE organization_id = $1 AND state = 'deleted'`;
// The first claim of a tick adds its row; the key makes each later claim of the tick, also a concurrent one, insert
// nothing. No lock stays held while the steps of the tick run.
const CLAIM_TICK = `INSERT INTO thermus_admin.tenant_sweep_ticks (tick_at, claimed_by) VALUES ($1::timestamptz, $2)
  ON CONFLICT (tick_at) DO NOTHING RETURNING tick_at`;
// After a conflict, the holder of the tick: a repeat of a claim whose answer got lost finds its own holder.
const TICK_HOLDER = 'SELECT claimed_by FROM thermus_admin.tenant_sweep_ticks WHERE tick_at = $1::timestamptz';

/** The fleet statements of the tenants table and the claim of the ticks of the sweeps, on the shared SQL runtime. */
export class PgTenantFleetStore implements TenantFleetStore {
  private readonly runtime: BoundedSqlRuntime;

  constructor(runtime: BoundedSqlRuntime) { this.runtime = runtime; }

  readFleet(): Promise<FleetRead> {
    return this.read(READ_FLEET, []);
  }

  // The cutoff comes from the tick of the sweep, not from the clock of the database, so the sweep decides the period.
  readIdle(plan: string, cutoff: string): Promise<FleetRead> {
    return this.read(READ_IDLE, [plan, cutoff]);
  }

  markDeleted(organizationId: string, from: RemovableState, serviceId: string | null): Promise<FleetWrite> {
    return this.change(MARK_DELETED, [organizationId, from, serviceId]);
  }

  // A failure before COMMIT destroys the client, so PostgreSQL rolls the transaction back and frees the lock.
  async reviveDeleted(organizationId: string, admit: (count: RegistryCount) => boolean): Promise<ReviveResult> {
    const result = await this.runtime.run(async (session) => {
      await session.query('BEGIN');
      await session.query(LOCK_REGISTRY);
      const count = registryCount(await session.query(COUNT_ROWS, [organizationId]));
      const revived = admit(count);
      if (revived) await session.query(REVIVE_DELETED, [organizationId], true);
      await session.query('COMMIT', [], revived);
      return revived ? { status: 'revived' as const } : { status: 'refused' as const, count };
    });
    return result.status === 'complete' ? result.value : result;
  }

  markSuspended(organizationId: string, serviceId: string): Promise<FleetWrite> {
    return this.change(MARK_SUSPENDED, [organizationId, serviceId]);
  }

  markResumed(organizationId: string, serviceId: string): Promise<FleetWrite> {
    return this.change(MARK_RESUMED, [organizationId, serviceId]);
  }

  recordDigest(organizationId: string, serviceId: string, imageDigest: string): Promise<FleetWrite> {
    return this.change(RECORD_DIGEST, [organizationId, serviceId, imageDigest]);
  }

  // A claim without a confirmed answer is unavailable: its row can exist, so the caller claims again to know.
  async claimTick(tickAt: string, holder: string): Promise<TickClaim> {
    const result = await this.runtime.run(async (session) => {
      if ((await session.query(CLAIM_TICK, [tickAt, holder], true)).length > 0) return true;
      const [row] = await session.query(TICK_HOLDER, [tickAt]);
      return row?.claimed_by === holder;
    });
    if (result.status !== 'complete') return { status: 'unavailable' };
    return { status: result.value ? 'claimed' : 'taken' };
  }

  // A read that does not complete is unavailable, so a partial read never looks complete.
  private async read(text: string, values: unknown[]): Promise<FleetRead> {
    const result = await this.runtime.run(async (session) => (await session.query(text, values)).map(fleetRowOf));
    return result.status === 'complete' ? { status: 'complete', rows: result.value } : { status: 'unavailable' };
  }

  // No changed row: the row is no longer in the start state or on the service of the change, because another writer moved it.
  private async change(text: string, values: unknown[]): Promise<FleetWrite> {
    const result = await this.runtime.run(async (session) => (await session.query(text, values, true)).length > 0);
    if (result.status !== 'complete') return { status: 'unavailable' };
    return { status: result.value ? 'recorded' : 'moved' };
  }
}

function fleetRowOf(row: Record<string, unknown>): FleetRow {
  return {
    organizationId: row.organization_id as string, state: row.state as TenantState,
    plan: row.plan as string | null, appliedPlan: row.applied_plan as string | null,
    serviceId: row.render_service_id as string | null, serviceName: row.service_name as string | null,
    internalUrl: row.internal_url as string | null, imageDigest: row.image_digest as string | null,
    failureReason: row.failure_reason as string | null, lastActiveAt: timeOf(row.last_active_at),
    createdAt: timeOf(row.created_at) ?? '', updatedAt: timeOf(row.updated_at) ?? '',
  };
}

// pg gives a timestamptz as a Date.
function timeOf(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  return typeof value === 'string' ? value : null;
}
