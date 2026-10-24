import assert from 'node:assert/strict';
import test from 'node:test';
import { Writable } from 'node:stream';
import { runInNewContext } from 'node:vm';
import { ConsoleSystemLogger } from '../../../src/logs/system/console-system-logger.ts';
import { AuditLog } from '../../../src/logs/audit/audit-log.ts';
import type { AuditEvent } from '../../../src/logs/audit/audit-log.ts';

test('Given a controlled customer sink, when explicit audit actions are recorded, then only named customer events reach that sink', () => {
  const events: AuditEvent[] = [];
  const audit = new AuditLog({ writeAuditEvent: (event) => { events.push(event); } });
  audit.toolCompleted({ timestamp: '2026-10-23T12:00:00Z', organizationId: 'org-a', actor: { authority: 'workos', subject: 'user-a' }, operationId: 'operation-a', tool: 'search', status: 'success', durationMs: 12 });
  audit.administrationChanged({ timestamp: '2026-10-23T12:00:01Z', organizationId: 'org-a', actor: { authority: 'workos', subject: 'admin-a' }, action: 'invite', target: { email: 'new@example.com' }, outcome: 'applied' });
  assert.deepEqual(events.map((event) => [event.eventName, event.organizationId]), [['mcp.tool.completed', 'org-a'], ['organization.changed', 'org-a']]);
});


test('Given separate system and customer outputs, when internal information and an audit action are logged, then only the system output has a caller location', () => {
  const written: string[] = [];
  const system = new ConsoleSystemLogger(undefined, new Writable({
    write(chunk, _encoding, done) { written.push(String(chunk)); done(); },
  }));
  const events: AuditEvent[] = [];
  const audit = new AuditLog({ writeAuditEvent: (event) => { events.push(event); } });
  runInNewContext('system.info("distinctive internal diagnostic")', { system }, { filename: 'internal-caller.js' });
  const completion = {
    timestamp: '2026-10-23T12:00:00Z', organizationId: 'org-a',
    actor: { authority: 'workos', subject: 'user-a', file: 'actor-source.ts', line: 4, stack: 'actor stack' },
    operationId: 'operation-a', tool: 'search' as const, status: 'success' as const, durationMs: 12,
    file: 'audit-source.ts', line: 9, stack: 'internal stack', message: 'distinctive internal diagnostic',
  };
  audit.toolCompleted(completion);
  assert.equal(written.length, 1);
  assert.ok(written[0].endsWith('[internal-caller.js:1]: distinctive internal diagnostic\n'));
  assert.deepEqual(events, [{
    eventName: 'mcp.tool.completed', timestamp: '2026-10-23T12:00:00Z', organizationId: 'org-a',
    actor: { authority: 'workos', subject: 'user-a' },
    operationId: 'operation-a', tool: 'search', status: 'success', durationMs: 12,
  }]);
});
