import assert from 'node:assert/strict';
import test from 'node:test';
import { AuditLog, type AuditEvent } from '../../../../src/logs/audit/audit-log.ts';

// The control plane captures the tool completions that a tenant relays (SO-05). The tenant runs the same projection,
// but it renders untrusted pages, so the control plane checks each relayed event again with the projection rules.

const projected = {
  timestamp: '2026-10-27T21:00:00.123Z',
  organizationId: 'workos:client_01CONTROL:org_A',
  actor: { authority: 'workos:client_01CONTROL', subject: 'user_A', name: 'Ann' },
  eventName: 'mcp.tool.completed',
  tool: 'getURLAsMarkdown',
  input: { url: 'https://source.example/story', reason: 'Read the source' },
  operationId: 'c0ffee00-0000-4000-8000-000000000001',
  status: 'success',
  durationMs: 12.5,
  result: { text: 'The cleaned page', originalBytes: 16, capturedBytes: 16, truncated: false },
} as const;

function captureSpy() {
  const events: AuditEvent[] = [];
  return { audit: new AuditLog({ writeAuditEvent: (event) => { events.push(event); } }), events };
}

test('Given a tool completion that a tenant projected and relayed, when the control plane checks it, then the checked copy equals it, and its capture writes it once', () => {
  const { audit, events } = captureSpy();

  const checked = audit.relayedToolCompletion(JSON.parse(JSON.stringify(projected)));
  assert.ok(checked !== undefined);
  audit.toolRelayed(checked);

  assert.deepEqual(checked, projected);
  assert.deepEqual(events, [projected]);
});

test('Given a relayed search completion with a truncated result, when the control plane checks it, then the copy keeps the search input and the counts of the tenant', () => {
  const search = { ...projected, tool: 'search', input: { query: 'public query', reason: 'Find it' }, result: { text: 'Results\n[TRUNCATED]', originalBytes: 90_000, capturedBytes: 19, truncated: true } };

  assert.deepEqual(captureSpy().audit.relayedToolCompletion(search), search);
});

test('Given relayed fields outside the contract, when the control plane checks the event, then the copy drops them', () => {
  const extended = { ...projected, stack: 'private stack', actor: { ...projected.actor, token: 'private token' }, result: { ...projected.result, html: '<p>private</p>' } };

  assert.deepEqual(captureSpy().audit.relayedToolCompletion(extended), projected);
});

test('Given a credential in a relayed input or result, when the control plane checks the event, then the copy redacts it as the projection does', () => {
  const leaked = { ...projected, input: { url: 'https://source.example/story?token=private-url-token', reason: 'Read it' }, result: { text: 'password: "private-result-password"', originalBytes: 35, capturedBytes: 35, truncated: false } };

  const checked = captureSpy().audit.relayedToolCompletion(leaked);

  assert.doesNotMatch(JSON.stringify(checked), /private-url-token|private-result-password/);
  assert.equal(checked?.result.capturedBytes, Buffer.byteLength(checked?.result.text ?? ''));
});

const broken: ReadonlyArray<readonly [string, unknown]> = [
  ['another event name', { ...projected, eventName: 'organization.changed' }],
  ['an unknown status', { ...projected, status: 'unknown-status' }],
  ['no operation ID', { ...projected, operationId: undefined }],
  ['a timestamp in another format', { ...projected, timestamp: '27 October 2026' }],
  ['an actor that is not an object', { ...projected, actor: 'user_A' }],
  ['an actor without a subject', { ...projected, actor: { authority: 'workos:client_01CONTROL' } }],
  ['an unknown tool', { ...projected, tool: 'execute' }],
  ['a URL that is not http', { ...projected, input: { url: 'file:///etc/passwd', reason: 'Read it' } }],
  ['a negative duration', { ...projected, durationMs: -1 }],
  ['a result without text', { ...projected, result: { originalBytes: 1, capturedBytes: 1, truncated: false } }],
  ['a result count that is not a whole number', { ...projected, result: { ...projected.result, originalBytes: 1.5 } }],
  ['a result text above the capture limit', { ...projected, result: { text: 'x'.repeat(65_537), originalBytes: 65_537, capturedBytes: 65_537, truncated: false } }],
  ['a value that is not an object', 'mcp.tool.completed'],
  ['null', null],
];

for (const [label, value] of broken) {
  test(`Given a relayed event with ${label}, when the control plane checks it, then there is no copy and its capture writes nothing`, () => {
    const { audit, events } = captureSpy();

    assert.equal(audit.relayedToolCompletion(value), undefined);
    audit.toolRelayed(value as Parameters<AuditLog['toolRelayed']>[0]);

    assert.deepEqual(events, []);
  });
}

test('Given a sink that throws, when a relayed completion is captured, then the relay route can continue', () => {
  const audit = new AuditLog({ writeAuditEvent: () => { throw new Error('private sink detail'); } });
  const checked = audit.relayedToolCompletion(projected);
  assert.ok(checked !== undefined);

  assert.doesNotThrow(() => audit.toolRelayed(checked));
});
