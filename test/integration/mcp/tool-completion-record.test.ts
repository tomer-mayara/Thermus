import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RequestContext } from '../../../src/accounts/identity/access-context.ts';
import { formatToolCompletion } from '../../../src/interfaces/mcp/tool-completion-record.ts';

const context: RequestContext = {
  user: { authority: 'synthetic-authority', subject: 'trusted-subject' }, tenantId: 'trusted-tenant', grants: [], permissions: [],
};
const operationId = 'D35803FB-2C25-4273-8967-99EED265721B';

function record(argumentsValue: unknown, name = 'getURLAsMarkdown') {
  return formatToolCompletion(context, { operationId, name, arguments: argumentsValue, status: 'invalid_arguments', durationMs: 7 });
}

test('Given credential-bearing URL and line breaks in a valid reason, when a completion is formatted, then JSON is one line and only safe fields are kept', () => {
  const encoded = record({ url: 'https://private-user:private-password@example.com/path?private-query=yes#private-fragment', reason: 'First line\nSecond\rline', headers: { authorization: 'private-token' }, cause: 'private-cause', html: 'private-html', markdown: 'private-markdown', subject: 'forged-subject' });
  const entry = JSON.parse(encoded);
  assert.equal(entry.operationId, operationId);
  assert.equal(entry.url, 'https://example.com/path');
  assert.equal(entry.urlStatus, 'invalid');
  assert.equal(entry.reason, 'First line\nSecond\rline');
  assert.equal(entry.authority, context.user.authority);
  assert.equal(entry.subject, context.user.subject);
  assert.equal(entry.tenantId, context.tenantId);
  assert.equal(entry.status, 'invalid_arguments');
  assert.equal(entry.durationMs, 7);
  assert.equal(encoded.includes('\n'), false);
  assert.equal(encoded.includes('\r'), false);
  assert.doesNotMatch(encoded, /private-|forged-/);
});

test('Given an unknown name, when a completion is formatted, then the label is fixed and the name is not copied', () => {
  const entry = record({ url: 'https://example.com', reason: 'Read' }, 'secret-unknown-name');
  assert.equal(JSON.parse(entry).tool, 'unknown');
  assert.doesNotMatch(entry, /secret-unknown-name/);
});

for (const [value, expected] of [[undefined, 'missing'], [null, 'not_string'], [42, 'not_string'], ['', 'empty'], [' \n\t', 'blank'], ['😀'.repeat(2_001), 'too_long']] as const) {
  test(`Given a ${expected} reason, when a completion is formatted, then it keeps only a field status`, () => {
    const entry = JSON.parse(record({ url: 'https://example.com', reason: value }));
    assert.equal(entry.reasonStatus, expected);
    assert.equal(Object.hasOwn(entry, 'reason'), false);
  });
}

for (const [value, expected] of [[undefined, 'missing'], [null, 'not_string'], ['', 'empty'], ['x'.repeat(8_193), 'too_long'], ['not-a-url', 'invalid'], ['file:///private-file', 'invalid']] as const) {
  test(`Given a ${expected} URL, when a completion is formatted, then no raw URL is copied`, () => {
    const entry = JSON.parse(record({ url: value, reason: 'Read' }));
    assert.equal(entry.urlStatus, expected);
    assert.equal(Object.hasOwn(entry, 'url'), false);
  });
}

test('Given a valid maximum reason with supplementary characters, when recorded, then all 2000 code points remain unchanged', () => {
  const reason = '😀'.repeat(2_000);
  assert.equal(JSON.parse(record({ url: 'https://example.com', reason })).reason, reason);
});
