import { randomUUID } from 'node:crypto';
import { createPgSettingsRuntime } from './bounded-sql-runtime.ts';
import type { BoundedSqlRuntime, SettingsSqlOptions } from './bounded-sql-runtime.ts';
import type { DestinationSettings, DestinationSettingsStore, ReadSettingsResult, SaveSettingsResult, StoredDestinationSettings } from './destination-settings-store.ts';

const columns = 'revision, endpoint, auth, enabled, encrypted_credential';
const unchanged = '(endpoint, auth, enabled, encrypted_credential) IS NOT DISTINCT FROM ($3::text, $4::text, $5::boolean, $6::text)';
const insert = `INSERT INTO thermus_admin.logging_destination_settings (tenant_id, revision, endpoint, auth, enabled, encrypted_credential)
  VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (tenant_id) DO NOTHING RETURNING ${columns}`;
const update = `UPDATE thermus_admin.logging_destination_settings SET
  revision = CASE WHEN ${unchanged} THEN revision ELSE $7::uuid END,
  endpoint = $3, auth = $4, enabled = $5, encrypted_credential = $6
  WHERE tenant_id = $1 AND revision::text = $2 RETURNING ${columns}`;

export class PgDestinationSettingsStore implements DestinationSettingsStore {
  private readonly runtime: BoundedSqlRuntime;

  constructor(runtime: BoundedSqlRuntime) { this.runtime = runtime; }

  async read(tenantId: string): Promise<ReadSettingsResult> {
    const result = await this.runtime.run(async (session) => {
      const rows = await session.query(`SELECT ${columns} FROM thermus_admin.logging_destination_settings WHERE tenant_id = $1`, [tenantId]);
      return rows[0] ? { status: 'found' as const, settings: settings(rows[0]) } : { status: 'absent' as const };
    });
    return result.status === 'complete' ? result.value : { status: 'unavailable' };
  }

  async save(tenantId: string, expectedRevision: string | null, desired: DestinationSettings): Promise<SaveSettingsResult> {
    const revision = randomUUID();
    const result = await this.runtime.run(async (session): Promise<SaveSettingsResult> => {
      const values = [tenantId, expectedRevision ?? revision, desired.endpoint, desired.auth, desired.enabled, desired.encryptedCredential];
      if (expectedRevision !== null) values.push(revision);
      const rows = await session.query(expectedRevision === null ? insert : update, values, true);
      if (!rows[0]) return { status: 'conflict' };
      const saved = settings(rows[0]);
      return { status: saved.revision === expectedRevision ? 'unchanged' : 'saved', settings: saved };
    });
    return result.status === 'complete' ? result.value : result;
  }
}

function settings(row: Record<string, unknown>): StoredDestinationSettings {
  return { revision: row.revision as string, endpoint: row.endpoint as string, auth: row.auth as DestinationSettings['auth'], enabled: row.enabled as boolean, encryptedCredential: row.encrypted_credential as string | null };
}

export function openDestinationSettingsRuntime(options: SettingsSqlOptions): { store: DestinationSettingsStore; close(): Promise<void> } {
  const runtime = createPgSettingsRuntime(options);
  return { store: new PgDestinationSettingsStore(runtime), close: () => runtime.close() };
}
