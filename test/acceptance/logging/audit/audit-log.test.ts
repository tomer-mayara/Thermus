import assert from 'node:assert/strict';
import test from 'node:test';
import { Writable } from 'node:stream';
import { runInNewContext } from 'node:vm';
import { SystemLogger } from '../../../../src/logs/system/system-logger.ts';
import { ConsoleSystemLogSink } from '../../../../src/logs/system/console-system-log-sink.ts';
import { AuditLog } from '../../../../src/logs/audit/audit-log.ts';
import type { AuditEvent } from '../../../../src/logs/audit/audit-log.ts';

test('Given a controlled customer sink, when explicit audit actions are recorded, then only named customer events reach that sink', () => {
  const events: AuditEvent[] = [];
  const audit = new AuditLog({ writeAuditEvent: (event) => { events.push(event); } });
  audit.toolCompleted({ timestamp: '2026-10-23T12:00:00Z', organizationId: 'org-a', actor: { authority: 'workos', subject: 'user-a' }, operationId: 'operation-a', tool: 'search', status: 'success', durationMs: 12, input: { query: 'public query', reason: 'public reason' }, result: 'public result' });
  audit.administrationChanged({ timestamp: '2026-10-23T12:00:01Z', organizationId: 'org-a', actor: { authority: 'workos', subject: 'admin-a' }, action: 'invite', target: { email: 'new@example.com' }, outcome: 'applied' });
  assert.deepEqual(events.map((event) => [event.eventName, event.organizationId]), [['mcp.tool.completed', 'org-a'], ['organization.changed', 'org-a']]);
});


test('Given separate system and customer outputs, when internal information and an audit action are logged, then only the system output has a caller location', () => {
  const written: string[] = [];
  const system = new SystemLogger(new ConsoleSystemLogSink(new Writable({
    write(chunk, _encoding, done) { written.push(String(chunk)); done(); },
  })));
  const events: AuditEvent[] = [];
  const audit = new AuditLog({ writeAuditEvent: (event) => { events.push(event); } });
  runInNewContext('system.info("distinctive internal diagnostic")', { system }, { filename: 'internal-caller.js' });
  const completion = {
    timestamp: '2026-10-23T12:00:00Z', organizationId: 'org-a',
    actor: { authority: 'workos', subject: 'user-a', file: 'actor-source.ts', line: 4, stack: 'actor stack' },
    operationId: 'operation-a', tool: 'search' as const, status: 'success' as const, durationMs: 12, input: { query: 'public query', reason: 'public reason' }, result: 'public result',
    file: 'audit-source.ts', line: 9, stack: 'internal stack', message: 'distinctive internal diagnostic',
  };
  audit.toolCompleted(completion);
  assert.equal(written.length, 1);
  assert.ok(written[0].endsWith('[internal-caller.js:1]: distinctive internal diagnostic\n'));
  assert.deepEqual(events, [{
    eventName: 'mcp.tool.completed', timestamp: '2026-10-23T12:00:00Z', organizationId: 'org-a',
    actor: { authority: 'workos', subject: 'user-a' },
    operationId: 'operation-a', tool: 'search', status: 'success', durationMs: 12, input: { query: 'public query', reason: 'public reason' }, result: { text: 'public result', originalBytes: 13, capturedBytes: 13, truncated: false },
  }]);
});

test('Given validated tool content with credential fields and a long Unicode result, when capture completes, then only a redacted bounded public copy reaches the customer sink', () => {
  const events: AuditEvent[] = [];
  const audit = new AuditLog({ writeAuditEvent: (event) => { events.push(event); } });
  const publicResult = 'See https://example.com/?access_token=result-secret and {"password":"field-secret"}. ' + '🦎'.repeat(40_000);
  audit.toolCompleted({ timestamp: '2026-10-23T12:00:00Z', organizationId: 'org-a', actor: { authority: 'workos', subject: 'user-a' }, operationId: 'operation-a', tool: 'getURLAsMarkdown', status: 'success', durationMs: 12,
    input: { url: 'https://example.com/?api_key=input-secret', reason: 'Read the public page' }, result: publicResult,
  });
  assert.equal(events.length, 1);
  const event = events[0];
  assert.equal(event.eventName, 'mcp.tool.completed');
  if (event.eventName !== 'mcp.tool.completed') return;
  assert.doesNotMatch(JSON.stringify(event), /input-secret|result-secret|field-secret/);
  assert.ok(event.result.text.includes('[TRUNCATED]'));
  assert.equal(event.result.originalBytes, Buffer.byteLength(publicResult));
  assert.equal(event.result.capturedBytes, Buffer.byteLength(event.result.text));
  assert.equal(event.result.truncated, true);
  assert.ok(event.result.text.isWellFormed());
  assert.ok(event.result.capturedBytes <= 65_536);
  assert.ok(Buffer.byteLength(JSON.stringify(event)) <= 131_072);
  assert.equal(publicResult.includes('result-secret'), true);
});
