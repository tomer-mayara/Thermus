import assert from 'node:assert/strict';
import type { CallToolResult, Client } from '@modelcontextprotocol/client';
import { generatedOperationIdPattern } from '../fixtures/execution-context.ts';

export function call(client: Client, subject: 'alice' | 'bob', signal?: AbortSignal) {
  return client.callTool({ name: 'getURLAsMarkdown', arguments: {
    url: `https://pages.example/${subject}`, reason: `Read ${subject}'s separate page`,
  } }, { signal });
}

export function assertSuccess(result: CallToolResult, subject: string) {
  assert.equal(result.isError, undefined);
  assert.deepEqual(result.content, [{ type: 'text', text: `Markdown for ${subject}\n` }]);
}

export function assertRecord(record: Record<string, unknown> | undefined, subject: string, status: string) {
  assert.ok(record);
  assert.match(record.operationId as string, generatedOperationIdPattern);
  assert.equal(record.subject, subject);
  assert.equal(record.authority, 'https://identity.example');
  assert.equal(record.tenantId, `${subject}-tenant`);
  assert.equal(record.url, `https://pages.example/${subject}`);
  assert.equal(record.reason, `Read ${subject}'s separate page`);
  assert.equal(record.status, status);
}

