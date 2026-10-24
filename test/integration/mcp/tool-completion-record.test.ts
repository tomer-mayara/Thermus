import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RequestContext } from '../../../src/accounts/identity/access-context.ts';
import { formatToolCompletion } from '../../../src/interfaces/mcp/tool-completion-record.ts';

const context: RequestContext = {
  user: { authority: 'synthetic-authority', subject: 'trusted-subject' }, tenantId: 'trusted-tenant', grants: [], permissions: [],
};
const operationId = 'D35803FB-2C25-4273-8967-99EED265721B';

function record(argumentsValue: unknown, name = 'getURLAsMarkdown') {
  const call = { operationId, name, arguments: argumentsValue, status: 'invalid_arguments' as const, durationMs: 7 };
  return formatToolCompletion(context, call);
}

for (const argumentsValue of [
  { url: 'https://private-user:private-password@example.com/private-path?private-query=yes#private-fragment', reason: 'PRIVATE reason\nSecond line', headers: { authorization: 'PRIVATE token' }, cause: 'PRIVATE cause', html: 'PRIVATE html', markdown: 'PRIVATE markdown', subject: 'forged-subject' },
  { url: 'https://example.com/' + '😀'.repeat(8_192), reason: '😀'.repeat(2_000) },
  { url: null, reason: 42 },
  undefined,
]) {
  test('Given untrusted tool content, when operator completion is formatted, then only stable metadata is recorded', () => {
    const encoded = record(argumentsValue);
    assert.deepEqual(JSON.parse(encoded), {
      event: 'mcp.tool.completed', operationId, authority: context.user.authority,
      subject: context.user.subject, tenantId: context.tenantId, tool: 'getURLAsMarkdown',
      status: 'invalid_arguments', durationMs: 7,
    });
    assert.doesNotMatch(encoded, /PRIVATE|private-|forged-|😀|url|reason|query|result|html/);
    assert.equal(encoded.includes('\n'), false);
  });
}

test('Given an unknown name, when operator completion is formatted, then the tool label is fixed', () => {
  const encoded = record({ url: 'https://example.com', reason: 'PRIVATE reason' }, 'PRIVATE unknown');
  assert.equal(JSON.parse(encoded).tool, 'unknown');
  assert.doesNotMatch(encoded, /PRIVATE|example.com/);
});
