import type { BoundedSqlRuntime } from '../../runtime/sql/bounded-sql-runtime.ts';
import type { InsertRequestedResult, ReadRoutesResult, RegistryCount, TenantRegistryStore, TenantRoute, TenantState } from './tenant-registry-store.ts';

// This mode conflicts with itself and with every row write, but not with a plain read: concurrent requests take
// turns at the cap, while the lookup keeps reading.
const LOCK_REGISTRY = 'LOCK TABLE thermus_admin.tenants IN SHARE ROW EXCLUSIVE MODE';
const COUNT_ROWS = `SELECT state, count(*)::integer AS rows, bool_or(organization_id = $1) AS current
  FROM thermus_admin.tenants GROUP BY state`;
const INSERT_REQUESTED = "INSERT INTO thermus_admin.tenants (organization_id, state) VALUES ($1, 'requested')";
const READ_ROUTES = 'SELECT organization_id, state, internal_url FROM thermus_admin.tenants';

export class PgTenantRegistryStore implements TenantRegistryStore {
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
}

function registryCount(rows: Record<string, unknown>[]): RegistryCount {
  const rowsByState = new Map(rows.map((row) => [row.state as TenantState, row.rows as number]));
  const current = rows.find((row) => row.current === true)?.state as TenantState | undefined;
  return current === undefined ? { rowsByState } : { current, rowsByState };
}

function routesOf(rows: Record<string, unknown>[]): ReadonlyMap<string, TenantRoute> {
  return new Map(rows.map((row) => [row.organization_id as string, { state: row.state as TenantState, internalUrl: row.internal_url as string | null }]));
}
