import assert from 'node:assert/strict';
import { test } from 'node:test';
import dns from 'node:dns/promises';
import { composeLoggingStorage } from '../../../../src/app/logging-storage.ts';
import { OtlpAuditSender } from '../../../../src/logs/audit/otlp-audit-sender.ts';
import type { AuditEvent } from '../../../../src/logs/audit/audit-log.ts';
import { DestinationSettingsFake } from '../../../support/doubles/logging/destination-settings-fake.ts';
import { AuditExportSenderSpy } from '../../../support/doubles/logging/audit-export-sender-spy.ts';

const eventFor = (tenant: string): Extract<AuditEvent, { eventName: 'mcp.tool.completed' }> => ({ eventName: 'mcp.tool.completed', timestamp: '2026-10-24T12:00:00Z', organizationId: tenant, actor: { authority: 'trusted', subject: 'admin' }, operationId: `operation-${tenant}`, tool: 'search', status: 'success', durationMs: 1, input: { query: 'public query', reason: 'Find source' }, result: { text: 'public result', originalBytes: 13, capturedBytes: 13, truncated: false } });
const endpoint = 'https://collector.example/v1/logs';
const turn = () => new Promise<void>(resolve => setImmediate(resolve));

test('Given queued export for an Axiom dataset, when its dataset changes before dispatch, then old queued work is dropped and new work reaches the sender with the current dataset', { timeout: 10_000 }, async t => {
  const store = new DestinationSettingsFake();
  const sender = new AuditExportSenderSpy();
  sender.held = true;
  const storage = composeLoggingStorage({ store, close: async () => {} }, Buffer.alloc(32, 7), sender);
  t.after(async () => { for (const attempt of sender.attempts) attempt.complete(); await storage.close(); });
  const desired = { expectedRevision: null, endpoint, axiomDataset: 'audit-log-test', auth: 'bearer' as const, token: 'audit-token', enabled: true };
  const saved = await storage.service.save('tenant-a', desired);
  assert.ok(saved.status === 'saved' && saved.settings.revision);
  assert.equal(storage.dispatch.admit({ destinationRevision: saved.settings.revision, event: { ...eventFor('tenant-a'), operationId: 'in-flight' } }), true);
  await sender.untilAttempts(1);
  assert.deepEqual(sender.attempts[0].destination, { endpoint, axiomDataset: 'audit-log-test', auth: { type: 'bearer', token: 'audit-token' } });
  assert.equal(storage.dispatch.admit({ destinationRevision: saved.settings.revision, event: { ...eventFor('tenant-a'), operationId: 'stale-queued' } }), true);
  const changed = await storage.service.save('tenant-a', { ...desired, expectedRevision: saved.settings.revision, axiomDataset: 'audit-next', token: '' });
  assert.ok(changed.status === 'saved' && changed.settings.revision);
  assert.equal(storage.dispatch.admit({ destinationRevision: changed.settings.revision, event: { ...eventFor('tenant-a'), operationId: 'current-queued' } }), true);
  sender.attempts[0].complete();
  await sender.untilAttempts(2);
  assert.deepEqual(sender.attempts.map(attempt => attempt.event.eventName === 'mcp.tool.completed' && attempt.event.operationId), ['in-flight', 'current-queued']);
  assert.deepEqual(sender.attempts[1].destination, { endpoint, axiomDataset: 'audit-next', auth: { type: 'bearer', token: 'audit-token' } });
});

test('Given production logging storage with one sender, when export and Test hold four native DNS lookups and then cancel, then both paths retain the shared sender cap until native work settles', { timeout: 10_000 }, async t => {
  const pending: ((addresses: { address: string; family: number }[]) => void)[] = [];
  t.mock.method(dns, 'lookup', () => new Promise(resolve => { pending.push(resolve); }));
  const store = new DestinationSettingsFake();
  const sender = new OtlpAuditSender();
  const storage = composeLoggingStorage({ store, close: async () => {} }, Buffer.alloc(32, 7), sender);
  const controllers = [new AbortController(), new AbortController()];
  t.after(async () => { controllers.forEach(controller => controller.abort()); await storage.close(); pending.forEach(resolve => resolve([{ address: '127.0.0.1', family: 4 }])); });
  const revisions: string[] = [];
  for (const tenant of ['tenant-a', 'tenant-b']) {
    const saved = await storage.service.save(tenant, { expectedRevision: null, endpoint, auth: 'none', token: '', enabled: true });
    assert.equal(saved.status, 'saved');
    if (saved.status !== 'saved') throw new Error('Expected saved settings');
    assert.ok(saved.settings.revision);
    revisions.push(saved.settings.revision);
  }
  assert.equal(storage.dispatch.admit({ destinationRevision: revisions[0], event: eventFor('tenant-a') }), true);
  assert.equal(storage.dispatch.admit({ destinationRevision: revisions[1], event: eventFor('tenant-b') }), true);
  await turn();
  const tests = ['tenant-a', 'tenant-b'].map((tenant, index) => storage.service.test({ organizationId: tenant, actor: { authority: 'trusted', subject: 'admin' } }, { expectedRevision: revisions[index], endpoint, auth: 'none', token: '', enabled: true }, controllers[index].signal));
  await turn();
  assert.equal(pending.length, 4);
  const busy = await storage.service.test({ organizationId: 'tenant-a', actor: { authority: 'trusted', subject: 'admin' } }, { expectedRevision: revisions[0], endpoint, auth: 'none', token: '', enabled: true });
  assert.equal(busy.status, 'tested');
  if (busy.status === 'tested') assert.equal(busy.outcome.kind, 'busy');
  controllers.forEach(controller => controller.abort());
  assert.deepEqual((await Promise.all(tests)).map(result => result.status), ['cancelled', 'cancelled']);
  await storage.close();
  assert.deepEqual(await sender.send({ endpoint, auth: { type: 'none' } }, eventFor('tenant-a')), { kind: 'busy' });
  pending.forEach(resolve => resolve([{ address: '127.0.0.1', family: 4 }]));
  await turn();
  assert.deepEqual(await sender.send({ endpoint: 'https://127.0.0.1/v1/logs', auth: { type: 'none' } }, eventFor('tenant-a')), { kind: 'permanent_failure', reason: 'unsafe_destination' });
  assert.equal(store.writes, 2);
});
