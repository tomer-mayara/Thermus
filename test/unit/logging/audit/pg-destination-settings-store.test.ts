import assert from 'node:assert/strict';
import test from 'node:test';
import type { TestContext } from 'node:test';
import { BoundedSqlRuntime } from '../../../../src/logs/audit/bounded-sql-runtime.ts';
import { PgDestinationSettingsStore } from '../../../../src/logs/audit/pg-destination-settings-store.ts';

const revision = 'b0fd8b9d-c2df-4b31-bf56-50228825bb05';
const previousRevision = '4a5c3911-ae48-4d71-8114-151e56ebbd28';
const desired = { endpoint: 'https://collector.example/v1/logs', auth: 'bearer' as const, enabled: true, encryptedCredential: 'opaque-encrypted-value' };
const stored = { ...desired, revision };
const row = { revision, endpoint: desired.endpoint, auth: desired.auth, enabled: desired.enabled, encrypted_credential: desired.encryptedCredential };

function settingsStore(t: TestContext, query: () => Promise<{ rows: Record<string, unknown>[] }>): PgDestinationSettingsStore {
  const runtime = new BoundedSqlRuntime({
    connect: async () => ({ query, release: () => {} }),
    end: async () => {}, on: () => {},
  });
  t.after(() => runtime.close());
  return new PgDestinationSettingsStore(runtime);
}

test('Given a stored Axiom dataset, when settings are read, then its dataset accompanies the saved revision', async (t) => {
  const store = settingsStore(t, async () => ({ rows: [{ ...row, axiom_dataset: 'audit-log-test' }] }));
  assert.deepEqual(await store.read('trusted-tenant'), { status: 'found', settings: { ...stored, axiomDataset: 'audit-log-test' } });
});

test('Given a stored SQL row, when settings are read, then the public result preserves the opaque settings and revision', async (t) => {
  const store = settingsStore(t, async () => ({ rows: [row] }));
  assert.deepEqual(await store.read('trusted-tenant'), { status: 'found', settings: stored });
});

test('Given no SQL row, when settings are read, then the public result reports absence', async (t) => {
  const store = settingsStore(t, async () => ({ rows: [] }));
  assert.deepEqual(await store.read('trusted-tenant'), { status: 'absent' });
});

test('Given a committed SQL row, when first or changed settings are saved, then the public result reports the saved revision', async (t) => {
  const store = settingsStore(t, async () => ({ rows: [row] }));
  assert.deepEqual(await store.save('trusted-tenant', null, desired), { status: 'saved', settings: stored });
  assert.deepEqual(await store.save('trusted-tenant', previousRevision, desired), { status: 'saved', settings: stored });
});

test('Given SQL preserves the expected revision, when settings are saved, then the public result reports an unchanged destination', async (t) => {
  const store = settingsStore(t, async () => ({ rows: [row] }));
  assert.deepEqual(await store.save('trusted-tenant', revision, desired), { status: 'unchanged', settings: stored });
});

test('Given SQL returns no saved row, when settings are saved, then the public result reports a conflict', async (t) => {
  const store = settingsStore(t, async () => ({ rows: [] }));
  assert.deepEqual(await store.save('trusted-tenant', null, desired), { status: 'conflict' });
  assert.deepEqual(await store.save('trusted-tenant', previousRevision, desired), { status: 'conflict' });
});

test('Given a query error with private details, when settings are read or saved, then only safe failure outcomes leave the store', async (t) => {
  const store = settingsStore(t, async () => { throw new Error('private database credential and endpoint'); });
  assert.deepEqual(await store.read('trusted-tenant'), { status: 'unavailable' });
  assert.deepEqual(await store.save('trusted-tenant', revision, desired), { status: 'unconfirmed' });
});
