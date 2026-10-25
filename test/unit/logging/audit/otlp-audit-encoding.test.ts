import assert from 'node:assert/strict';
import test from 'node:test';
import type { AuditEvent } from '../../../../src/logs/audit/audit-log.ts';
import { AuditLog } from '../../../../src/logs/audit/audit-log.ts';
import { encodeAuditEvent } from '../../../../src/logs/audit/otlp-audit-encoding.ts';

const event: AuditEvent = { eventName: 'mcp.tool.completed', timestamp: '2026-10-23T12:00:00.123456789Z', organizationId: 'org-a', actor: { authority: 'workos', subject: 'user-a' }, operationId: 'operation-a', tool: 'search', status: 'success', durationMs: 3, input: { query: 'public query', reason: 'public reason' }, result: { text: 'public result', originalBytes: 13, capturedBytes: 13, truncated: false } };

test('Given a tool audit event with injected system fields, when encoded, then only named audit metadata reaches OTLP', () => {
  const encoded = encodeAuditEvent({ ...event, file: '/private/source.ts', line: 4, stack: 'private stack', actor: { ...event.actor, stack: 'private actor stack' } } as AuditEvent);
  const request = JSON.parse(encoded.toString());
  const record = request.resourceLogs[0].scopeLogs[0].logRecords[0];
  assert.equal(record.eventName, 'mcp.tool.completed');
  assert.equal(record.timeUnixNano, (BigInt(Date.parse('2026-10-23T12:00:00Z')) * 1_000_000n + 123_456_789n).toString());
  assert.equal(record.body.stringValue, 'mcp.tool.completed');
  assert.equal(record.attributes.find((attribute: { key: string }) => attribute.key === 'organization.id').value.stringValue, 'org-a');
  assert.equal(record.attributes.find((attribute: { key: string }) => attribute.key === 'duration.ms').value.doubleValue, 3);
  assert.doesNotMatch(encoded.toString(), /private|source\.ts|stack|file|line/);
});
test('Given an administration change, when encoded, then the allowed target and role are present', () => {
  const change = { ...event, eventName: 'organization.changed', action: 'invite', target: { email: 'new@example.com', file: '/private' }, role: 'user', outcome: 'applied' } as unknown as AuditEvent;
  const encoded = encodeAuditEvent(change).toString();
  assert.match(encoded, /new@example.com/);
  assert.match(encoded, /applied/);
  assert.doesNotMatch(encoded, /operation-a|private|file/);
});
for (const timestamp of ['not a time', '2026-02-31T12:00:00Z', '2026-10-23', '1960-01-01T00:00:00Z', '9999-01-01T00:00:00Z']) {
  test(`Given invalid audit time ${timestamp}, when encoded, then the event is refused`, () => assert.throws(() => encodeAuditEvent({ ...event, timestamp })));
}
test('Given an oversized audit field, when encoded, then no oversized request can be produced', () => assert.throws(() => encodeAuditEvent({ ...event, organizationId: 'x'.repeat(262_145) })));
test('Given escaping expands a bounded field beyond request bytes, when encoded, then the request is refused', () => assert.throws(() => encodeAuditEvent({ ...event, organizationId: '\u0000'.repeat(50_000) })));
test('Given invalid event discriminant, when encoded, then the event is refused', () => assert.throws(() => encodeAuditEvent({ ...event, eventName: 'system.error' } as unknown as AuditEvent)));
test('Given invalid duration, when encoded, then the event is refused', () => assert.throws(() => encodeAuditEvent({ ...event, durationMs: Number.POSITIVE_INFINITY })));

test('Given a destination Test record with injected diagnostics, when encoded, then OTLP explicitly labels synthetic work and copies only Test fields', () => {
  const synthetic = { ...event, eventName: 'audit.destination.test', destinationRevision: 'saved-r1', endpoint: 'https://secret.example', token: 'private-token', file: '/private.ts', line: 12 } as unknown as AuditEvent;
  const encoded = encodeAuditEvent(synthetic).toString();
  const record = JSON.parse(encoded).resourceLogs[0].scopeLogs[0].logRecords[0];
  assert.equal(record.eventName, 'audit.destination.test');
  assert.equal(record.attributes.find((attribute: { key: string }) => attribute.key === 'destination.revision').value.stringValue, 'saved-r1');
  assert.equal(record.attributes.find((attribute: { key: string }) => attribute.key === 'synthetic.type').value.stringValue, 'destination_test');
  assert.doesNotMatch(encoded, /operation-a|search|duration.ms|private|secret|endpoint|token|file|line/);
});

test('Given captured input and result, when encoded, then OTLP retains public content and result size metadata', () => {
  const events: AuditEvent[] = [];
  const audit = new AuditLog({ writeAuditEvent: (event) => { events.push(event); } });
  audit.toolCompleted({ timestamp: event.timestamp, organizationId: event.organizationId, actor: event.actor, operationId: 'operation-a', tool: 'search', status: 'success', durationMs: 3, input: { query: 'public query', reason: 'public reason' }, result: 'final public text' });
  const record = JSON.parse(encodeAuditEvent(events[0]).toString()).resourceLogs[0].scopeLogs[0].logRecords[0];
  const attributes = Object.fromEntries(record.attributes.map((attribute: { key: string; value: unknown }) => [attribute.key, attribute.value]));
  assert.deepEqual(attributes['input.query'], { stringValue: 'public query' });
  assert.deepEqual(attributes['input.reason'], { stringValue: 'public reason' });
  assert.deepEqual(attributes['result.text'], { stringValue: 'final public text' });
  assert.deepEqual(attributes['result.original_bytes'], { doubleValue: 17 });
  assert.deepEqual(attributes['result.captured_bytes'], { doubleValue: 17 });
  assert.deepEqual(attributes['result.truncated'], { boolValue: false });
});

for (const change of [{ action: 'save' as const, outcome: 'saved' as const }, { action: 'test' as const, outcome: 'tested' as const }]) {
  test(`Given destination ${change.action} metadata with injected settings, when encoded, then OTLP has only the action and outcome`, () => {
    const events: AuditEvent[] = [];
    const audit = new AuditLog({ writeAuditEvent: (value) => { events.push(value); } });
    audit.destinationChanged({ timestamp: event.timestamp, organizationId: event.organizationId, actor: event.actor, ...change });
    const encoded = encodeAuditEvent({ ...events[0], endpoint: 'https://private.example', token: 'private-token', settings: { enabled: true }, file: '/private.ts' } as unknown as AuditEvent).toString();
    const record = JSON.parse(encoded).resourceLogs[0].scopeLogs[0].logRecords[0];
    assert.equal(record.eventName, 'audit.destination.changed');
    assert.equal(record.body.stringValue, 'audit.destination.changed');
    assert.deepEqual(Object.fromEntries(record.attributes.map((attribute: { key: string; value: unknown }) => [attribute.key, attribute.value])), {
      'organization.id': { stringValue: 'org-a' }, 'actor.authority': { stringValue: 'workos' }, 'actor.subject': { stringValue: 'user-a' },
      action: { stringValue: change.action }, outcome: { stringValue: change.outcome },
    });
    assert.doesNotMatch(encoded, /private|endpoint|token|settings|enabled|file|synthetic|destination.revision/);
  });
}

test('Given a roleless invitation revoke, when projected and encoded, then OTLP keeps only the named invitation metadata', () => {
  const events: AuditEvent[] = [];
  const audit = new AuditLog({ writeAuditEvent: (value) => { events.push(value); } });
  audit.administrationChanged({ timestamp: event.timestamp, organizationId: event.organizationId, actor: event.actor, action: 'revoke-invitation', target: { invitationId: 'invitation-a' }, outcome: 'applied' });
  assert.equal(events.length, 1);
  const encoded = encodeAuditEvent(events[0]).toString();
  const record = JSON.parse(encoded).resourceLogs[0].scopeLogs[0].logRecords[0];
  assert.equal(record.eventName, 'organization.changed');
  assert.equal(record.body.stringValue, 'organization.changed');
  assert.deepEqual(Object.fromEntries(record.attributes.map((attribute: { key: string; value: unknown }) => [attribute.key, attribute.value])), {
    'organization.id': { stringValue: 'org-a' }, 'actor.authority': { stringValue: 'workos' }, 'actor.subject': { stringValue: 'user-a' },
    action: { stringValue: 'revoke-invitation' }, 'target.invitation_id': { stringValue: 'invitation-a' }, outcome: { stringValue: 'applied' },
  });
  assert.doesNotMatch(encoded, /target.email|"role"|operation.id|tool.name|duration.ms|input\.|result\./);
});

for (const name of [' Zoë O’Neil — 李 ', 'é'.repeat(512), '', ' ', 42, '\ud800', 'bad\nname', 'é'.repeat(513)]) {
  test('Given optional actor display metadata, when OTLP encodes a direct event, then valid bounded names are named attributes and invalid names leave the identity intact', () => {
    const actor = Object.assign({}, event.actor, { name });
    const record = JSON.parse(encodeAuditEvent({ ...event, actor } as AuditEvent).toString()).resourceLogs[0].scopeLogs[0].logRecords[0];
    const attributes = Object.fromEntries(record.attributes.map((attribute: { key: string; value: unknown }) => [attribute.key, attribute.value]));
    assert.deepEqual(attributes['actor.subject'], { stringValue: event.actor.subject });
    const expected = typeof name === 'string' && (name.startsWith(' Zoë') || name.length === 512) ? { stringValue: name.trim() } : undefined;
    assert.deepEqual(attributes['actor.name'], expected);
  });
}
