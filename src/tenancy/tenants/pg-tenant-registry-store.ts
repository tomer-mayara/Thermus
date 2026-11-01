import type { BoundedSqlRuntime } from '../../runtime/sql/bounded-sql-runtime.ts';
import type { GatewayWrite, ResumeMark, TenantGatewayStore } from './tenant-gateway-store.ts';
import type { InsertRequestedResult, ReadRoutesResult, RegistryCount, TenantRegistryStore, TenantRoute, TenantState } from './tenant-registry-store.ts';

// This mode conflicts with itself and with every row write, but not with a plain read: concurrent requests take
// turns at the cap, while the lookup keeps reading. The revive of the fleet store takes the same lock and count.
export const LOCK_REGISTRY = 'LOCK TABLE thermus_admin.tenants IN SHARE ROW EXCLUSIVE MODE';
export const COUNT_ROWS = `SELECT state, count(*)::integer AS rows, bool_or(organization_id = $1) AS current
  FROM thermus_admin.tenants GROUP BY state`;
const INSERT_REQUESTED = "INSERT INTO thermus_admin.tenants (organization_id, state) VALUES ($1, 'requested')";
// The time since the last change comes from the clock of the database, which also writes updated_at.
const READ_ROUTES = `SELECT organization_id, state, internal_url, extract(epoch FROM now() - updated_at)::float8 * 1000 AS since_change_ms
  FROM thermus_admin.tenants`;
// Each gateway write names the state that it starts from, so concurrent calls, also of another process, move a row
// one time; the restore also names the service of the mark. The activity write keeps the state and updated_at: it is
// not a change of the row.
const MARK_RESUMING = `UPDATE thermus_admin.tenants SET state = 'deploying', updated_at = now()
  WHERE organization_id = $1 AND state = 'suspended' AND render_service_id IS NOT NULL RETURNING render_service_id`;
const RESTORE_SUSPENDED = `UPDATE thermus_admin.tenants SET state = 'suspended', updated_at = now()
  WHERE organization_id = $1 AND state = 'deploying' AND render_service_id = $2 RETURNING organization_id`;
const RECORD_ACTIVE = 'UPDATE thermus_admin.tenants SET last_active_at = now() WHERE organization_id = $1 RETURNING organization_id';

export class PgTenantRegistryStore implements TenantRegistryStore, TenantGatewayStore {
  private readonly runtime: BoundedSqlRuntime;

  constructor(runtime: BoundedSqlRuntime) { this.runtime = runtime; }

  // A failure before COMMIT destroys the client, so PostgreSQL rolls the transaction back and frees the lock.
  async insertRequested(organizationId: string, admit: (count: RegistryCount) => boolean): Promise<InsertRequestedResult> {
    const result = await this.runtime.run(async (session) => {
      await session.query('BEGIN');
      await session.query(LOCK_REGISTRY);
      const count = registryCount(await session.query(COUNT_ROWS, [organizationId]));
      const inserted = admit(count);
      if (inserted) await session.query(INSERT_REQUESTED, [organizationId], true);
      await session.query('COMMIT', [], inserted);
      return inserted ? { status: 'inserted' as const } : { status: 'refused' as const, count };
    });
    return result.status === 'complete' ? result.value : result;
  }

  async readRoutes(): Promise<ReadRoutesResult> {
    const result = await this.runtime.run(async (session) => routesOf(await session.query(READ_ROUTES)));
    return result.status === 'complete' ? { status: 'complete', routes: result.value } : { status: 'unavailable' };
  }

  // An unconfirmed mark gives no service ID, so no resume goes: it counts as unavailable.
  async markResuming(organizationId: string): Promise<ResumeMark> {
    const result = await this.runtime.run(async (session) => session.query(MARK_RESUMING, [organizationId], true));
    if (result.status !== 'complete') return { status: 'unavailable' };
    const serviceId = result.value[0]?.render_service_id;
    return typeof serviceId === 'string' ? { status: 'resuming', serviceId } : { status: 'moved' };
  }

  restoreSuspended(organizationId: string, serviceId: string): Promise<GatewayWrite> {
    return this.write(RESTORE_SUSPENDED, [organizationId, serviceId]);
  }

  recordActive(organizationId: string): Promise<GatewayWrite> {
    return this.write(RECORD_ACTIVE, [organizationId]);
  }

  private async write(text: string, values: readonly string[]): Promise<GatewayWrite> {
    const result = await this.runtime.run(async (session) => (await session.query(text, [...values], true)).length > 0);
    if (result.status !== 'complete') return { status: 'unavailable' };
    return { status: result.value ? 'recorded' : 'moved' };
  }
}

export function registryCount(rows: Record<string, unknown>[]): RegistryCount {
  const rowsByState = new Map(rows.map((row) => [row.state as TenantState, row.rows as number]));
  const current = rows.find((row) => row.current === true)?.state as TenantState | undefined;
  return current === undefined ? { rowsByState } : { current, rowsByState };
}

function routesOf(rows: Record<string, unknown>[]): ReadonlyMap<string, TenantRoute> {
  return new Map(rows.map((row) => [row.organization_id as string, {
    state: row.state as TenantState, internalUrl: row.internal_url as string | null, sinceChangeMs: Number(row.since_change_ms),
  }]));
}
