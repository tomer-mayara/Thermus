import assert from 'node:assert/strict';
import test from 'node:test';
import { AUDIT_CAPTURE_LIMITS, AuditLog } from '../../../../src/logs/audit/audit-log.ts';
import type { AuditEvent, ToolCompletion } from '../../../../src/logs/audit/audit-log.ts';
import { encodeAuditEvent } from '../../../../src/logs/audit/otlp-audit-encoding.ts';

const context = { timestamp: '2026-10-23T12:00:00Z', organizationId: 'org-a', actor: { authority: 'workos', subject: 'user-a' }, operationId: 'operation-a', status: 'success' as const, durationMs: 3 };
function capture(completion: ToolCompletion): AuditEvent[] {
  const events: AuditEvent[] = [];
  new AuditLog({ writeAuditEvent: (event) => { events.push(event); } }).toolCompleted(completion);
  return events;
}

test('Given validated search input and extra fields, when capture runs, then only named content and safe metadata are copied', () => {
  const input = { query: 'public query', reason: 'public reason', token: 'private-extra' };
  const events = capture({ ...context, tool: 'search', input, result: '', _meta: { private: 'metadata' } } as ToolCompletion);
  assert.deepEqual(events, [{ ...context, eventName: 'mcp.tool.completed', tool: 'search', input: { query: 'public query', reason: 'public reason' }, result: { text: '', originalBytes: 0, capturedBytes: 0, truncated: false } }]);
});

test('Given known credential fields and encoded URL parameter names, when capture runs, then redaction applies to every public text field', () => {
  const result = 'https://example.com/?%61ccess_token=url-secret&ok=public {"password":"field-secret"} Authorization: Bearer header-secret';
  const [event] = capture({ ...context, tool: 'search', input: { query: 'https://example.com/?api_key=query-secret', reason: 'token=reason-secret' }, result });
  assert.doesNotMatch(JSON.stringify(event), /url-secret|field-secret|header-secret|query-secret|reason-secret/);
  assert.match(JSON.stringify(event), /REDACTED/);
});

for (const invalid of [
  { tool: 'unknown' }, { input: { query: '', reason: 'why' } }, { input: { query: 'query', reason: '' } },
  { input: { query: 'query', reason: 'x'.repeat(2001) } }, { result: {} }, { durationMs: -1 },
  { organizationId: 'x'.repeat(1025) }, { actor: { authority: 'workos', subject: '' } }, { status: 'raw_exception' },
  { timestamp: 'not a time' }, { input: { query: '\ud800', reason: 'why' } },
]) {
  test(`Given unsupported capture data ${JSON.stringify(invalid).slice(0, 90)}, when capture runs, then it drops the event`, () => {
    assert.deepEqual(capture({ ...context, tool: 'search', input: { query: 'query', reason: 'why' }, result: 'public', ...invalid } as ToolCompletion), []);
  });
}

test('Given maximum valid fetch input and escaped multibyte results, when capture runs, then input stays complete and both serialized budgets hold', () => {
  const url = 'https://example.com/' + '🦎'.repeat(8192 - 20);
  const reason = '\u0000'.repeat(1999) + 'x';
  const result = ('\u0000🦎"\\').repeat(40_000);
  const [event] = capture({ ...context, tool: 'getURLAsMarkdown', input: { url, reason }, result });
  assert.equal(event?.eventName, 'mcp.tool.completed');
  if (event?.eventName !== 'mcp.tool.completed') return;
  assert.deepEqual(event.input, { url, reason });
  assert.equal(event.result.originalBytes, Buffer.byteLength(result));
  assert.equal(event.result.capturedBytes, Buffer.byteLength(event.result.text));
  assert.ok(event.result.capturedBytes <= AUDIT_CAPTURE_LIMITS.resultBytes);
  assert.ok(Buffer.byteLength(JSON.stringify(event)) <= AUDIT_CAPTURE_LIMITS.eventBytes);
  assert.ok(encodeAuditEvent(event).length <= 262144);
  assert.ok(event.result.text.isWellFormed());
  assert.equal(event.result.truncated, true);
  assert.match(event.result.text, /\[TRUNCATED\]$/);
});

test('Given a refused sink, when capture runs, then the caller receives no failure', () => {
  const audit = new AuditLog({ writeAuditEvent: () => false });
  assert.doesNotThrow(() => audit.toolCompleted({ ...context, tool: 'search', input: { query: 'query', reason: 'why' }, result: 'public' }));
});

test('Given a maximum valid fetch URL with lone surrogates and escaped reason text, when capture runs, then the validated input is preserved', () => {
  const url = 'https://example.com/' + '\ud800'.repeat(8192 - 20);
  const reason = '\u0000'.repeat(1999) + 'x';
  const [event] = capture({ ...context, tool: 'getURLAsMarkdown', input: { url, reason }, result: 'public\ud800' });
  assert.equal(event?.eventName, 'mcp.tool.completed');
  if (event?.eventName !== 'mcp.tool.completed') return;
  assert.deepEqual(event.input, { url, reason });
  assert.equal(event.result.text, 'public\ufffd');
  assert.equal(event.result.originalBytes, Buffer.byteLength('public\ud800'));
  assert.ok(Buffer.byteLength(JSON.stringify(event)) <= AUDIT_CAPTURE_LIMITS.eventBytes);
  assert.ok(encodeAuditEvent(event).length <= 262144);
});

test('Given a credential field with escaped quotes, when capture runs, then the whole credential value is redacted', () => {
  const result = '{"password":"prefix\\"secret-tail","public":"shown"}';
  const [event] = capture({ ...context, tool: 'search', input: { query: 'query', reason: 'why' }, result });
  assert.doesNotMatch(JSON.stringify(event), /prefix|secret-tail/);
  assert.match(JSON.stringify(event), /shown/);
});

test('Given maximum valid search input and a result at the byte boundary, when capture runs, then only the exported copy is truncated', () => {
  const result = '🦎'.repeat(AUDIT_CAPTURE_LIMITS.resultBytes / 4 + 1);
  const [event] = capture({ ...context, tool: 'search', input: { query: '🦎'.repeat(512), reason: '\u0000'.repeat(1999) + 'x' }, result });
  if (event?.eventName !== 'mcp.tool.completed') return assert.fail('Expected tool event');
  assert.ok(event.result.text.isWellFormed());
  assert.equal(event.result.originalBytes, 65540);
  assert.equal(event.result.capturedBytes, 65536);
  assert.match(event.result.text, /\[TRUNCATED\]$/);
  assert.equal(result.length, 32770);
});

test('Given a result exactly at the result byte limit, when capture runs, then no truncation marker is added', () => {
  const result = '🦎'.repeat(AUDIT_CAPTURE_LIMITS.resultBytes / 4);
  const [event] = capture({ ...context, tool: 'search', input: { query: 'query', reason: 'why' }, result });
  if (event?.eventName !== 'mcp.tool.completed') return assert.fail('Expected tool event');
  assert.deepEqual(event.result, { text: result, originalBytes: 65536, capturedBytes: 65536, truncated: false });
});

test('Given a Save or Test action with extra settings, when capture runs, then only action metadata reaches the sink', () => {
  const events: AuditEvent[] = [];
  const audit = new AuditLog({ writeAuditEvent: (event) => { events.push(event); } });
  const change = { ...context, action: 'save' as const, outcome: 'saved' as const, endpoint: 'https://secret.example', token: 'private-token', settings: { enabled: true } };
  audit.destinationChanged(change);
  assert.deepEqual(events, [{ timestamp: context.timestamp, organizationId: 'org-a', actor: context.actor, eventName: 'audit.destination.changed', action: 'save', outcome: 'saved' }]);
  assert.doesNotThrow(() => new AuditLog({ writeAuditEvent: () => { throw new Error('private'); } }).destinationChanged(change));
});

test('Given an unsupported admin action or outcome, when capture runs, then no event reaches the sink', () => {
  const events: AuditEvent[] = [];
  const audit = new AuditLog({ writeAuditEvent: (event) => { events.push(event); } });
  audit.administrationChanged({ ...context, action: 'mfa-reset', target: { email: 'new@example.com' }, outcome: 'applied' } as unknown as Parameters<AuditLog['administrationChanged']>[0]);
  audit.destinationChanged({ ...context, action: 'save', outcome: 'raw-provider-message' } as unknown as Parameters<AuditLog['destinationChanged']>[0]);
  assert.deepEqual(events, []);
});

test('Given maximum escaped input and identity metadata, when capture runs, then the event budget reserves every field before result text', () => {
  const identity = '\u0000'.repeat(AUDIT_CAPTURE_LIMITS.metadataBytes);
  const url = 'https://example.com/' + '\ud800'.repeat(8192 - 20);
  const reason = '\u0000'.repeat(1999) + 'x';
  const result = '\u0000'.repeat(100_000);
  const [event] = capture({ ...context, organizationId: identity, actor: { authority: identity, subject: identity }, operationId: identity, tool: 'getURLAsMarkdown', input: { url, reason }, result });
  if (event?.eventName !== 'mcp.tool.completed') return assert.fail('Expected tool event');
  assert.deepEqual(event.input, { url, reason });
  assert.equal(event.organizationId, identity);
  assert.ok(event.result.capturedBytes < AUDIT_CAPTURE_LIMITS.resultBytes);
  assert.ok(Buffer.byteLength(JSON.stringify(event)) <= AUDIT_CAPTURE_LIMITS.eventBytes);
  assert.ok(encodeAuditEvent(event).length <= 262144);
  assert.equal(event.result.truncated, true);
});

test('Given unknown credential objects with throwing getters, when capture runs, then capture reads only named public fields', () => {
  const input = { query: 'public query', reason: 'public reason', get cookies(): never { throw new Error('cookies must not be read'); }, get authorization(): never { throw new Error('headers must not be read'); } };
  const completion = { ...context, tool: 'search' as const, input, result: 'public result', get _meta(): never { throw new Error('metadata must not be read'); } };
  assert.equal(capture(completion).length, 1);
});

test('Given the result limit cuts a quoted credential after a backslash, when capture runs, then no credential tail survives redaction', () => {
  const credentialPrefix = '{"password":"start PRIVATE-SECRET-' + 's'.repeat(120) + String.fromCharCode(92);
  const result = 'x'.repeat(AUDIT_CAPTURE_LIMITS.resultBytes - credentialPrefix.length) + credentialPrefix + 'x"}';
  const [event] = capture({ ...context, tool: 'search', input: { query: 'query', reason: 'why' }, result });
  if (event?.eventName !== 'mcp.tool.completed') return assert.fail('Expected tool event');
  assert.doesNotMatch(event.result.text, /PRIVATE-SECRET|ssssss/);
  assert.match(event.result.text, /REDACTED/);
  assert.equal(event.result.truncated, true);
});

test('Given an incomplete quoted credential with an escaped quote and backslash, when capture runs, then the full remaining value is redacted', () => {
  const result = '{"password":"start PRIVATE-tail\\" continued' + String.fromCharCode(92);
  const [event] = capture({ ...context, tool: 'search', input: { query: 'query', reason: 'why' }, result });
  if (event?.eventName !== 'mcp.tool.completed') return assert.fail('Expected tool event');
  assert.doesNotMatch(event.result.text, /PRIVATE-tail|continued/);
  assert.match(event.result.text, /REDACTED/);
});

for (const value of ['first line\nPRIVATE-second-line', 'first\\nPRIVATE-escaped-newline', 'first\\"PRIVATE-escaped-quote']) {
  test(`Given quoted credential content ${JSON.stringify(value)}, when capture runs, then its complete value is redacted`, () => {
    const result = `{"password":"${value}","public":"visible"}`;
    const [event] = capture({ ...context, tool: 'search', input: { query: 'query', reason: 'why' }, result });
    if (event?.eventName !== 'mcp.tool.completed') return assert.fail('Expected tool event');
    assert.doesNotMatch(event.result.text, /PRIVATE|first/);
    assert.match(event.result.text, /visible/);
  });
}

for (const credential of ['"PRIVATE-quoted-secret"', "'PRIVATE-single-secret'", '<PRIVATE-angle-secret>']) {
  test(`Given an accepted fetch URL with credential value ${credential}, when capture runs, then the complete recognized query value is redacted`, () => {
    const url = `https://example.com/?token=${credential}&public=visible`;
    const [event] = capture({ ...context, tool: 'getURLAsMarkdown', input: { url, reason: 'Read public content' }, result: `See ${url}` });
    if (event?.eventName !== 'mcp.tool.completed') return assert.fail('Expected tool event');
    assert.doesNotMatch(JSON.stringify(event), /PRIVATE|secret/);
    assert.deepEqual(event.input, { url: 'https://example.com/?token=[REDACTED]&public=visible', reason: 'Read public content' });
    assert.match(event.result.text, /public=visible/);
  });
}

test('Given quoted or angle credential parameters in search input, when capture runs, then query and reason retain only safe copies', () => {
  const [event] = capture({ ...context, tool: 'search', input: { query: 'https://example.com/?token="PRIVATE-query-secret"&public=query', reason: 'Read https://example.com/?api_key=<PRIVATE-reason-secret>&public=reason' }, result: 'Public result remains unchanged' });
  if (event?.eventName !== 'mcp.tool.completed') return assert.fail('Expected tool event');
  assert.deepEqual(event.input, { query: 'https://example.com/?token=[REDACTED]&public=query', reason: 'Read https://example.com/?api_key=[REDACTED]&public=reason' });
  assert.equal(event.result.text, 'Public result remains unchanged');
  assert.doesNotMatch(JSON.stringify(event), /PRIVATE|secret/);
});

for (const [result, expected] of [
  ['{"url":"https://example.com/?token=PRIVATE","public":"visible"}', '{"url":"https://example.com/?token=[REDACTED]","public":"visible"}'],
  ['{"message":"See https://example.com/?token=PRIVATE","keep":"KEEP_PUBLIC"}', '{"message":"See https://example.com/?token=[REDACTED]","keep":"KEEP_PUBLIC"}'],
  ['"https://example.com/?token=PRIVATE"', '"https://example.com/?token=[REDACTED]"'],
  ['{"https://example.com/?token=PRIVATE":"PUBLIC_VALUE","keep":"KEEP_PUBLIC"}', '{"https://example.com/?token=[REDACTED]":"PUBLIC_VALUE","keep":"KEEP_PUBLIC"}'],
  ["{'url':'https://example.com/?token=PRIVATE','public':'visible'}", "{'url':'https://example.com/?token=[REDACTED]','public':'visible'}"],
  ['[visible](https://example.com/?token=PRIVATE) suffix', '[visible](https://example.com/?token=[REDACTED]) suffix'],
  ['[visible](https://example.com/?token=PRIVATE), suffix', '[visible](https://example.com/?token=[REDACTED]), suffix'],
  ['[visible](https://example.com/?token=prefix(PRIVATE-tail)), suffix', '[visible](https://example.com/?token=[REDACTED]), suffix'],
  ['<https://example.com/?token=PRIVATE> suffix', '<https://example.com/?token=[REDACTED]> suffix'],
  ['https://example.com/?token="PRIVATE\\"tail" public', 'https://example.com/?token=[REDACTED] public'],
  ["https://example.com/?token='PRIVATE\\'tail' public", 'https://example.com/?token=[REDACTED] public'],
  ['https://example.com/?token=<PRIVATE> public', 'https://example.com/?token=[REDACTED] public'],
] as const) {
  test(`Given a credential URL in public text ${JSON.stringify(result)}, when capture runs, then only the credential value is replaced`, () => {
    const [event] = capture({ ...context, tool: 'search', input: { query: result, reason: result }, result });
    if (event?.eventName !== 'mcp.tool.completed') return assert.fail('Expected tool event');
    assert.deepEqual(event.input, { query: expected, reason: expected });
    assert.equal(event.result.text, expected);
    assert.doesNotMatch(event.result.text, /PRIVATE|tail/);
  });
}

for (const credential of ['prefix"PRIVATE-tail"', "prefix'PRIVATE-tail'", 'prefix<PRIVATE-tail>', 'PRIVATE(value)[with]{punctuation}']) {
  test(`Given a validated fetch URL with raw value ${credential}, when capture runs, then its complete query credential is removed`, () => {
    const url = `https://example.com/?token=${credential}&public=visible`;
    const [event] = capture({ ...context, tool: 'getURLAsMarkdown', input: { url, reason: 'Read public content' }, result: 'Public result' });
    if (event?.eventName !== 'mcp.tool.completed') return assert.fail('Expected tool event');
    assert.deepEqual(event.input, { url: 'https://example.com/?token=[REDACTED]&public=visible', reason: 'Read public content' });
  });
}

test('Given the result byte limit cuts a quoted URL credential after an escape, when capture runs, then its full captured value is removed', () => {
  const prefix = 'https://example.com/?token="PRIVATE-' + 's'.repeat(80) + String.fromCharCode(92);
  const result = '🦎'.repeat((AUDIT_CAPTURE_LIMITS.resultBytes - prefix.length) / 4) + 'x'.repeat((AUDIT_CAPTURE_LIMITS.resultBytes - prefix.length) % 4) + prefix + 'x"';
  const [event] = capture({ ...context, tool: 'search', input: { query: 'query', reason: 'why' }, result });
  if (event?.eventName !== 'mcp.tool.completed') return assert.fail('Expected tool event');
  assert.doesNotMatch(event.result.text, /PRIVATE|ssssss/);
  assert.match(event.result.text, /REDACTED/);
  assert.ok(event.result.text.isWellFormed());
  assert.ok(event.result.capturedBytes <= AUDIT_CAPTURE_LIMITS.resultBytes);
  assert.equal(event.result.capturedBytes, Buffer.byteLength(event.result.text));
  assert.equal(event.result.originalBytes, Buffer.byteLength(result));
  assert.equal(event.result.truncated, true);
});

for (const value of ['prefix"PRIVATE-tail', 'prefix(PRIVATE-tail)', '"first"PRIVATE-tail', "'first'PRIVATE-tail", '<first>PRIVATE-tail']) {
  test(`Given an ambiguous URL credential ${value}, when public text is captured, then redaction keeps the full query value private`, () => {
    const url = `https://example.com/?token=${value}&ok=public`;
    const [event] = capture({ ...context, tool: 'search', input: { query: `See ${url}`, reason: `Read ${url}` }, result: `Result ${url}` });
    if (event?.eventName !== 'mcp.tool.completed') return assert.fail('Expected tool event');
    const safeUrl = 'https://example.com/?token=[REDACTED]&ok=public';
    assert.deepEqual(event.input, { query: `See ${safeUrl}`, reason: `Read ${safeUrl}` });
    assert.equal(event.result.text, `Result ${safeUrl}`);
    assert.doesNotMatch(JSON.stringify(event), /PRIVATE|first|prefix/);
  });
}

test('Given an unclosed string of escaped quotes before a credential URL, when capture runs, then the full credential is removed and the prefix stays unchanged', () => {
  const prefix = '"' + '\\"'.repeat(160);
  const result = `${prefix}https://example.com/?token=PRIVATE`;
  const [event] = capture({ ...context, tool: 'search', input: { query: 'public query', reason: 'public reason' }, result });
  if (event?.eventName !== 'mcp.tool.completed') return assert.fail('Expected tool event');
  assert.equal(event.result.text, `${prefix}https://example.com/?token=[REDACTED]`);
  assert.equal(event.result.truncated, false);
  assert.equal(event.result.capturedBytes, Buffer.byteLength(event.result.text));
});

for (const name of ['Zoë O’Neil — 李', 'é'.repeat(512)]) {
  test('Given a trusted display name, when an audit event is projected, then the actor keeps the name in a frozen detached record', () => {
    const actor = { ...context.actor, name };
    const events = capture({ ...context, actor, tool: 'search', input: { query: 'query', reason: 'reason' }, result: 'result' });
    assert.deepEqual(events[0]?.actor, actor);
    assert.notEqual(events[0]?.actor, actor);
    assert.ok(Object.isFrozen(events[0]?.actor));
  });
}

for (const name of ['', ' ', 42, '\ud800', 'line\nname', '\u0085name', 'é'.repeat(513)]) {
  test(`Given an invalid optional name ${JSON.stringify(name).slice(0, 35)}, when an audit event is projected, then the event keeps its identity and omits the name`, () => {
    const events = capture({ ...context, actor: Object.assign({}, context.actor, { name }) as ToolCompletion['actor'], tool: 'search', input: { query: 'query', reason: 'reason' }, result: 'result' });
    assert.deepEqual(events[0]?.actor, context.actor);
  });
}
