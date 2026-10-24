import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatToolCompletion } from '../../../src/interfaces/mcp/tool-completion-record.ts';

const context = { user: { authority: 'trusted', subject: 'actor' }, tenantId: 'tenant', grants: [], permissions: [] };

test('Given malformed search arguments with throwing getters, when a completion is formatted, then no argument is read', () => {
  const args = new Proxy({}, { get() { throw new Error('PRIVATE getter'); } });
  const call = { operationId: 'operation', name: 'search', arguments: args, status: 'invalid_arguments' as const, durationMs: 0 };
  const record = formatToolCompletion(context, call);
  assert.deepEqual(JSON.parse(record), { event: 'mcp.tool.completed', operationId: 'operation', authority: 'trusted', subject: 'actor', tenantId: 'tenant', tool: 'search', status: 'invalid_arguments', durationMs: 0 });
});

for (const name of ['getURLAsMarkdown', 'search', 'PRIVATE unknown']) {
  test(`Given ${name} arguments with throwing getters, when operator completion is formatted, then only metadata remains`, () => {
    const args = new Proxy({}, { get() { throw new Error('PRIVATE input'); } });
    const call = { operationId: 'operation', name, arguments: args, status: 'success' as const, durationMs: 2 };
    const record = formatToolCompletion(context, call);
    assert.deepEqual(JSON.parse(record), { event: 'mcp.tool.completed', operationId: 'operation', authority: 'trusted', subject: 'actor', tenantId: 'tenant', tool: name === 'PRIVATE unknown' ? 'unknown' : name, status: 'success', durationMs: 2 });
  });
}
