import assert from 'node:assert/strict';
import { test } from 'node:test';
import { searchToolInputSchema, parseSearchToolArguments } from '../../../src/mcp/search-tool-schema.ts';

test('Given search discovery, when inspected, then query and reason are the only required fields', () => {
  assert.deepEqual(searchToolInputSchema.required, ['query', 'reason']);
  assert.equal(searchToolInputSchema.additionalProperties, false);
  assert.deepEqual(Object.keys(searchToolInputSchema.properties), ['query', 'reason']);
  assert.equal(searchToolInputSchema.properties.query.maxLength, 512);
  assert.equal(searchToolInputSchema.properties.reason.maxLength, 2_000);
});

test('Given valid boundary queries and reasons, when parsed, then spelling and Unicode scalar limits are preserved', async () => {
  for (const query of ['a', '😀'.repeat(512), 'x'.repeat(512), '  e\u0301 + % & /  ']) {
    for (const reason of ['a', '😀'.repeat(2_000), 'x'.repeat(2_000), '  read\nthis  ']) {
      assert.deepEqual(await parseSearchToolArguments({ query, reason }), { query, reason });
    }
  }
});

test('Given invalid query or reason arguments, when parsed, then dispatch is refused', async () => {
  const invalid = [undefined, null, [], {}, { query: 'a' }, { reason: 'a' },
    { query: 'a', reason: 'a', extra: true },
    ...['', ' \n\t\u2003', '😀'.repeat(513), 'x'.repeat(513), '\ud800', '\udc00', 'a\ud800b', 1].map(query => ({ query, reason: 'read' })),
    ...['', ' \n\t\u2003', '😀'.repeat(2_001), 'x'.repeat(2_001), 1].map(reason => ({ query: 'a', reason }))];
  for (const args of invalid) assert.equal(await parseSearchToolArguments(args), undefined);
});
