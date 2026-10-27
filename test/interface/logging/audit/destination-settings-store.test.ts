import assert from 'node:assert/strict';
import test from 'node:test';
import { BoundedSqlRuntime } from '../../../../src/runtime/sql/bounded-sql-runtime.ts';
import { PgDestinationSettingsStore } from '../../../../src/logs/audit/pg-destination-settings-store.ts';

test('Given a failed read, when database errors contain credentials, then the public result contains no database detail', async () => {
  const runtime = new BoundedSqlRuntime({ connect: async () => { throw new Error('secret-password'); }, end: async () => {}, on: () => {} });
  const store = new PgDestinationSettingsStore(runtime);
  assert.deepEqual(await store.read('trusted-tenant'), { status: 'unavailable' });
  assert.deepEqual(await store.save('trusted-tenant', null, { endpoint: 'https://collector.example', auth: 'none', enabled: false, encryptedCredential: null }), { status: 'unavailable' });
  await runtime.close();
});
