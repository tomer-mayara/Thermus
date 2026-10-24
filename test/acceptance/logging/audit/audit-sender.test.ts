import assert from 'node:assert/strict';
import test from 'node:test';
import { AuditLog } from '../../../../src/logs/audit/audit-log.ts';
import type { AuditEvent } from '../../../../src/logs/audit/audit-log.ts';
import { OtlpAuditSender } from '../../../../src/logs/audit/otlp-audit-sender.ts';

const completion = { timestamp: '2026-10-23T12:00:00.123Z', organizationId: 'org-a', actor: { authority: 'workos', subject: 'user-a' }, operationId: 'op-a', tool: 'search' as const, status: 'success' as const, durationMs: 3 };

test('Given a projected customer audit event and a private destination, when the sender connects, then neither content nor credentials leave the sender', async () => {
  const events: AuditEvent[] = [];
  new AuditLog({ writeAuditEvent(event) { events.push(event); } }).toolCompleted(completion);
  const sender = new OtlpAuditSender();
  const outcome = await sender.send({ endpoint: 'https://127.0.0.1:4318/v1/logs', auth: { type: 'bearer', token: 'customer-secret' } }, events[0]);
  assert.deepEqual(outcome, { kind: 'permanent_failure', reason: 'unsafe_destination' });
  assert.doesNotMatch(JSON.stringify(outcome), /customer-secret|org-a|user-a/);
});
