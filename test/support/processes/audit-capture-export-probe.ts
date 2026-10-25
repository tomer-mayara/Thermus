import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { composeLoggingStorage } from '../../../src/app/logging-storage.ts';
import { AuditLog } from '../../../src/logs/audit/audit-log.ts';
import { AuditSnapshots } from '../../../src/logs/audit/audit-snapshots.ts';
import { OtlpAuditSender } from '../../../src/logs/audit/otlp-audit-sender.ts';
import type { AuditSendOutcome } from '../../../src/logs/audit/audit-send.ts';
import type { DestinationSettings, StoredDestinationSettings } from '../../../src/logs/audit/destination-settings-store.ts';

const destination: { endpoint: string; token: string } = JSON.parse(await readFile('/fixture/captured-export.json', 'utf8'));
const tenant = 'runtime-capture-tenant';
let settings: StoredDestinationSettings | undefined;
let saves = 0;
let reads = 0;
const store = {
  read: async (id: string) => { assert.equal(id, tenant); reads++; return settings === undefined ? { status: 'absent' as const } : { status: 'found' as const, settings: { ...settings } }; },
  save: async (id: string, previous: string | null, desired: DestinationSettings) => {
    assert.equal(id, tenant); assert.equal(previous, settings?.revision ?? null); saves++;
    settings = { ...desired, revision: `runtime-export-${saves}` };
    return { status: 'saved' as const, settings: { ...settings } };
  },
};
const sender = new OtlpAuditSender();
const attempted = Promise.withResolvers<AuditSendOutcome>();
const tracked = {
  send: sender.send.bind(sender),
  start: (...args: Parameters<OtlpAuditSender['start']>) => {
    const attempt = sender.start(...args);
    void attempt.outcome.then(outcome => attempted.resolve(outcome));
    return attempt;
  },
};
const storage = composeLoggingStorage({ store, close: async () => {} }, new Uint8Array(32).fill(7), tracked);
const snapshots = new AuditSnapshots(store, storage.dispatch);
const audit = new AuditLog(snapshots);
const actor = { authority: 'runtime-capture-authority', subject: 'runtime-capture-admin' };
const result = 'password=private-result-token\n' + '🦎'.repeat(20_000);
const completion = { timestamp: '2026-10-24T12:00:00Z', organizationId: tenant, actor, operationId: 'runtime-captured-operation', tool: 'search' as const, status: 'success' as const, durationMs: 2, input: { query: 'runtime token=private-query-token', reason: 'api_key=private-reason-token' }, result };
try {
  const saved = await storage.service.save(tenant, { expectedRevision: null, endpoint: destination.endpoint, auth: 'bearer', token: destination.token, enabled: true });
  assert.ok(saved.status === 'saved');
  assert.ok(saved.settings.revision);
  const revision = saved.settings.revision;
  const beforeDispatchReads = reads;
  const guard = setTimeout(() => attempted.resolve({ kind: 'unconfirmed', reason: 'timeout' }), 7_000);
  let exported: AuditSendOutcome;
  try { audit.toolCompleted(completion); exported = await attempted.promise; }
  finally { clearTimeout(guard); }
  const dispatchReads = reads - beforeDispatchReads;
  const tested = await storage.service.test(tenant, { expectedRevision: revision, endpoint: destination.endpoint, auth: 'bearer', token: '', enabled: true }, actor);
  process.stdout.write(`${JSON.stringify({ exported, tested, saves, dispatchReads, productResultBytes: Buffer.byteLength(result) })}\n`);
} finally {
  snapshots.close();
  await storage.close();
}
