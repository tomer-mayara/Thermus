import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatToolCompletion } from '../../../src/mcp/tool-completion-record.ts';

const context = { user: { authority: 'trusted', subject: 'actor' }, tenantId: 'tenant', grants: [], permissions: [] };

test('Given malformed search arguments with throwing getters, when a completion is formatted, then no argument is read', () => {
  const args = new Proxy({}, { get() { throw new Error('PRIVATE getter'); } });
  const record = formatToolCompletion(context, { operationId: 'operation', name: 'search', arguments: args, status: 'invalid_arguments', durationMs: 0 });
  assert.deepEqual(JSON.parse(record), { event: 'mcp.tool.completed', operationId: 'operation', authority: 'trusted', subject: 'actor', tenantId: 'tenant', tool: 'search', status: 'invalid_arguments', durationMs: 0 });
});
