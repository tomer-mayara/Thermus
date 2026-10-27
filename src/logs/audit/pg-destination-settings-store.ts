import { randomUUID } from 'node:crypto';
import type { RemovalIntent, RemovalOperation, RemovalOperationStore, RemovalTerminal } from '../../accounts/organizations/removal-operation-store.ts';
import { createPgSettingsRuntime } from '../../runtime/sql/bounded-sql-runtime.ts';
import type { BoundedSqlRuntime, SettingsSqlOptions } from '../../runtime/sql/bounded-sql-runtime.ts';
import type { DestinationSettings, DestinationSettingsStore, ReadSettingsResult, SaveSettingsResult, StoredDestinationSettings } from './destination-settings-store.ts';

const columns = 'revision, endpoint, auth, enabled, encrypted_credential, axiom_dataset';
const unchanged = '(endpoint, auth, enabled, encrypted_credential, axiom_dataset) IS NOT DISTINCT FROM ($3::text, $4::text, $5::boolean, $6::text, $7::text)';
const insert = `INSERT INTO thermus_admin.logging_destination_settings (tenant_id, revision, endpoint, auth, enabled, encrypted_credential, axiom_dataset)
  VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (tenant_id) DO NOTHING RETURNING ${columns}`;
const update = `UPDATE thermus_admin.logging_destination_settings SET
  revision = CASE WHEN ${unchanged} THEN revision ELSE $8::uuid END,
  endpoint = $3, auth = $4, enabled = $5, encrypted_credential = $6, axiom_dataset = $7
  WHERE tenant_id = $1 AND revision::text = $2 RETURNING ${columns}`;

const removalColumns = 'organization_id, operation_id, membership_id, revision, actor_authority, actor_subject, started_at, outcome';
const admitRemoval = `INSERT INTO thermus_admin.membership_removal_operations (${removalColumns})
  VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)
  ON CONFLICT (organization_id) DO UPDATE SET operation_id = EXCLUDED.operation_id,
    membership_id = EXCLUDED.membership_id, revision = EXCLUDED.revision,
    actor_authority = EXCLUDED.actor_authority, actor_subject = EXCLUDED.actor_subject,
    started_at = EXCLUDED.started_at, outcome = NULL
  WHERE membership_removal_operations.outcome IS NOT NULL RETURNING operation_id`;
const completeRemoval = `UPDATE thermus_admin.membership_removal_operations SET outcome = $3
  WHERE organization_id = $1 AND operation_id = $2 AND (outcome IS NULL OR outcome = $3)
  RETURNING outcome`;

export class PgDestinationSettingsStore implements DestinationSettingsStore, RemovalOperationStore {
  private readonly runtime: BoundedSqlRuntime;

  constructor(runtime: BoundedSqlRuntime) { this.runtime = runtime; }

  async admitRemoval(intent: RemovalIntent): ReturnType<RemovalOperationStore['admitRemoval']> {
    const result = await this.runtime.run(async (session) => {
      const rows = await session.query(admitRemoval, [intent.organizationId, intent.operationId, intent.membershipId, intent.revision, intent.actor.authority, intent.actor.subject, intent.startedAt], true);
      return { status: rows[0] ? 'admitted' as const : 'busy' as const };
    });
    return result.status === 'complete' ? result.value : result;
  }

  async readRemoval(organizationId: string): ReturnType<RemovalOperationStore['readRemoval']> {
    const result = await this.runtime.run(async (session) => {
      const rows = await session.query(`SELECT ${removalColumns} FROM thermus_admin.membership_removal_operations WHERE organization_id = $1`, [organizationId]);
      return rows[0] ? { status: 'found' as const, operation: removalOperation(rows[0]) } : { status: 'absent' as const };
    });
    return result.status === 'complete' ? result.value : { status: 'unavailable' };
  }

  async completeRemoval(organizationId: string, operationId: string, outcome: RemovalTerminal): ReturnType<RemovalOperationStore['completeRemoval']> {
    const result = await this.runtime.run(async (session) => {
      const rows = await session.query(completeRemoval, [organizationId, operationId, outcome], true);
      return { status: rows[0] ? 'completed' as const : 'mismatch' as const };
    });
    return result.status === 'complete' ? result.value : result;
  }

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
      const values = [tenantId, expectedRevision ?? revision, desired.endpoint, desired.auth, desired.enabled, desired.encryptedCredential, desired.axiomDataset ?? null];
      if (expectedRevision !== null) values.push(revision);
      const rows = await session.query(expectedRevision === null ? insert : update, values, true);
      if (!rows[0]) return { status: 'conflict' };
      const saved = settings(rows[0]);
      return { status: saved.revision === expectedRevision ? 'unchanged' : 'saved', settings: saved };
    });
    return result.status === 'complete' ? result.value : result;
  }
}

function removalOperation(row: Record<string, unknown>): RemovalOperation {
  return { organizationId: row.organization_id as string, operationId: row.operation_id as string,
    membershipId: row.membership_id as string, revision: row.revision as string,
    actor: { authority: row.actor_authority as string, subject: row.actor_subject as string },
    startedAt: (row.started_at as Date).toISOString(), outcome: row.outcome as RemovalTerminal | null };
}

function settings(row: Record<string, unknown>): StoredDestinationSettings {
  return { revision: row.revision as string, endpoint: row.endpoint as string, ...(row.axiom_dataset == null ? {} : { axiomDataset: row.axiom_dataset as string }), auth: row.auth as DestinationSettings['auth'], enabled: row.enabled as boolean, encryptedCredential: row.encrypted_credential as string | null };
}

export function openDestinationSettingsRuntime(options: SettingsSqlOptions): { store: DestinationSettingsStore & RemovalOperationStore; close(): Promise<void> } {
  const runtime = createPgSettingsRuntime(options);
  return { store: new PgDestinationSettingsStore(runtime), close: () => runtime.close() };
}
