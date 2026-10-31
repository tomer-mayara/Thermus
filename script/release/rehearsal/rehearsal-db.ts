// The reads of the staging database of the rehearsal, with the runtime role, verified TLS, and the CA of the project.
// The runtime role has no DELETE grant, and these reads change nothing.
import { createPgSettingsRuntime } from '../../../src/runtime/sql/bounded-sql-runtime.ts';

type Print = (line: string) => void;

const TABLES = ['logging_destination_settings', 'membership_removal_operations', 'tenants', 'subscriptions', 'billing_events'] as const;
// The pooler is in us-west-1: a connection from this machine needs more time than the bounds of the server.
const BOUNDS = { acquisitionMs: 15_000, operationMs: 15_000, statementMs: 10_000, closeMs: 5_000 };

async function withSession<T>(connection: { readonly connectionString: string; readonly ca: string }, work: (query: (text: string) => Promise<Record<string, unknown>[]>) => Promise<T>): Promise<T> {
  const runtime = createPgSettingsRuntime({ ...connection, bounds: BOUNDS });
  try {
    const result = await runtime.run((session) => work((text) => session.query(text)));
    if (result.status !== 'complete') throw new Error(`The staging database read is ${result.status}.`);
    return result.value;
  } finally {
    await runtime.close();
  }
}

/** The row count of each of the five tables of thermus_admin. */
export async function printCounts(connection: { readonly connectionString: string; readonly ca: string }, print: Print): Promise<void> {
  await withSession(connection, async (query) => {
    for (const table of TABLES) {
      const [row] = await query(`SELECT count(*)::int AS rows FROM thermus_admin.${table}`);
      print(`thermus_admin.${table}: ${String(row?.rows)} rows`);
    }
  });
}

/** The rows of thermus_admin.tenants, and the count of each state. */
export async function printTenants(connection: { readonly connectionString: string; readonly ca: string }, print: Print): Promise<void> {
  await withSession(connection, async (query) => {
    const rows = await query('SELECT organization_id, state, plan, render_service_id, service_name, internal_url, image_digest, last_active_at, failure_reason, created_at, updated_at FROM thermus_admin.tenants ORDER BY created_at');
    for (const row of rows) print(Object.entries(row).map(([key, value]) => `${key}=${value instanceof Date ? value.toISOString() : String(value)}`).join('  '));
    const states = await query('SELECT state, count(*)::int AS rows FROM thermus_admin.tenants GROUP BY state ORDER BY state');
    print(`By state: ${states.map((row) => `${String(row.state)} ${String(row.rows)}`).join(', ') || 'no row'}`);
  });
}
