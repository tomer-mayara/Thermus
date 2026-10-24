import assert from 'node:assert/strict';
import test from 'node:test';
import dns from 'node:dns/promises';
import { AuditLog } from '../../../../src/logs/audit/audit-log.ts';
import type { AuditEvent } from '../../../../src/logs/audit/audit-log.ts';
import { DestinationSettingsService } from '../../../../src/logs/audit/destination-settings-service.ts';
import type { DestinationTestSender } from '../../../../src/logs/audit/destination-test.ts';
import { OtlpAuditSender } from '../../../../src/logs/audit/otlp-audit-sender.ts';
import { DestinationSettingsFake } from '../../../support/doubles/logging/destination-settings-fake.ts';

const senderStub: DestinationTestSender = { send: async () => { throw new Error('Save and export authorization must not send a Test.'); } };

const desired = { expectedRevision: null, endpoint: 'https://collector.example/v1/logs', auth: 'bearer' as const, enabled: true, token: 'saved-token' };

test('Given queued work for one saved revision, when another instance changes that version, then authorization drops old work and recovers only the current tenant credential', async () => {
  const store = new DestinationSettingsFake();
  const service = new DestinationSettingsService(store, Buffer.alloc(32, 6), senderStub);
  const other = new DestinationSettingsService(store, Buffer.alloc(32, 6), senderStub);
  const saved = await service.save('tenant-a', desired);
  assert.equal(saved.status, 'saved'); if (saved.status !== 'saved') return;
  const savedRevision = saved.settings.revision;
  assert.ok(savedRevision);
  const changed = await other.save('tenant-a', { ...desired, expectedRevision: savedRevision, endpoint: 'https://new-collector.example/v1/logs', token: 'replacement-token' });
  assert.equal(changed.status, 'saved'); if (changed.status !== 'saved') return;
  const changedRevision = changed.settings.revision;
  assert.ok(changedRevision);
  assert.deepEqual(await service.authorizeExport('tenant-a', savedRevision), { status: 'changed' });
  assert.deepEqual(await service.authorizeExport('tenant-a', changedRevision), { status: 'ready', destination: { endpoint: 'https://new-collector.example/v1/logs', auth: { type: 'bearer', token: 'replacement-token' } } });
  assert.deepEqual(await service.authorizeExport('tenant-b', changedRevision), { status: 'changed' });
});

test('Given uncancellable DNS and a cancelled export, when its public outcome settles, then content is erased while physical sender admission remains occupied until disposal', async t => {
  const pending: Array<(value: { address: string; family: number }[]) => void> = [];
  t.mock.method(dns, 'lookup', () => new Promise(resolve => { pending.push(resolve); }));
  const buffers: Buffer[] = [];
  const original = Buffer.from;
  t.mock.method(Buffer, 'from', (...args: unknown[]) => {
    const buffer = Reflect.apply(original, Buffer, args) as Buffer;
    if (typeof args[0] === 'string' && args[0].includes('distinctive-export-content')) buffers.push(buffer);
    return buffer;
  });
  const events: AuditEvent[] = [];
  new AuditLog({ writeAuditEvent: value => { events.push(value); } }).toolCompleted({ timestamp: '2026-10-24T12:00:00Z', organizationId: 'tenant-a', actor: { authority: 'provider', subject: 'actor' }, operationId: 'operation', tool: 'search', input: { query: 'query', reason: 'reason' }, result: 'distinctive-export-content', status: 'success', durationMs: 1 });
  const sender = new OtlpAuditSender();
  const controller = new AbortController();
  const attempts = Array.from({ length: 4 }, () => sender.start({ endpoint: desired.endpoint, auth: { type: 'none' } }, events[0], controller.signal));
  let disposed = 0;
  for (const attempt of attempts) void attempt.settled.then(() => { disposed++; });
  controller.abort();
  assert.deepEqual(await Promise.all(attempts.map(attempt => attempt.outcome)), Array.from({ length: 4 }, () => ({ kind: 'cancelled' })));
  assert.equal(buffers.length, 4);
  assert.ok(buffers.every(buffer => buffer.every(byte => byte === 0)));
  assert.equal(disposed, 0);
  assert.deepEqual(await sender.send({ endpoint: desired.endpoint, auth: { type: 'none' } }, events[0]), { kind: 'busy' });
  for (const finish of pending) finish([{ address: '8.8.8.8', family: 4 }]);
  await Promise.all(attempts.map(attempt => attempt.settled));
  assert.equal(disposed, 4);
});
