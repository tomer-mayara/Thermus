import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openFetchSite } from '../../support/in-process/mcp-fetch-site.ts';

const reason = 'Find sources for this task';

test('Given an authorized MCP client, when it discovers tools, then search and page fetch are available with bounded search arguments', async (t) => {
  const { client } = await openFetchSite(t, '2026-07-28');
  const { tools } = await client.listTools();

  assert.ok(tools.some(({ name }) => name === 'getURLAsMarkdown'));
  const search = tools.find(({ name }) => name === 'search');
  assert.ok(search, 'The search tool must be available');
  assert.partialDeepStrictEqual(search.inputSchema, {
    type: 'object',
    properties: {
      query: { type: 'string', minLength: 1, maxLength: 512, pattern: '\\S' },
      reason: { type: 'string', minLength: 1, maxLength: 2_000, pattern: '\\S' },
    },
    required: ['query', 'reason'],
    additionalProperties: false,
  });
});

test('Given an authorized MCP client, when search arguments are invalid, then each call returns only the fixed invalid-arguments error', async (t) => {
  const { client } = await openFetchSite(t, '2026-07-28');
  const invalidArguments = [
    { reason },
    { query: '', reason },
    { query: ' \n\t', reason },
    { query: 'x'.repeat(513), reason },
    { query: '\uD800', reason },
    { query: 'sources' },
    { query: 'sources', reason: '' },
    { query: 'sources', reason: ' \n\t' },
    { query: 'sources', reason: 'x'.repeat(2_001) },
    { query: 'sources', reason, extra: 'untrusted' },
  ];

  for (const argumentsValue of invalidArguments) {
    const result = await client.callTool({ name: 'search', arguments: argumentsValue });
    assert.deepEqual(result.content, [{ type: 'text', text: 'Invalid tool arguments' }]);
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent, undefined);
  }
});
