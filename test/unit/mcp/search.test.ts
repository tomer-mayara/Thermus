import assert from 'node:assert/strict';
import { test } from 'node:test';
import { projectSearchOutcome } from '../../../src/mcp/search.ts';
import type { SearchOutcome } from '../../../src/search-pipeline/search-pipeline.ts';

test('Given released search text, when projected, then one exact text result is returned', () => {
  for (const markdown of ['  # Result\n😀\n', 'No search results.']) {
    assert.deepEqual(projectSearchOutcome({ status: 'released', markdown }), { content: [{ type: 'text', text: markdown }] });
  }
});

test('Given withheld search content, when projected, then a fixed safe tool error is returned', () => {
  for (const code of ['scan_failed', 'scan_limit'] as const) {
    assert.deepEqual(projectSearchOutcome({ status: 'withheld', code }), {
      content: [{ type: 'text', text: 'Search content withheld' }], isError: true,
    });
  }
});

test('Given malformed search outcomes, when projected, then processing fails with a fixed safe error', () => {
  const malformed = [undefined, null, [], '', {}, { status: 'released' }, { status: 'released', markdown: 1 },
    { status: 'released', markdown: ' \n' }, { status: 'withheld' }, { status: 'withheld', code: 'secret' },
    { status: 'secret', markdown: 'secret' },
    { get status() { throw new Error('secret'); } },
    { status: 'released', get markdown() { throw new Error('secret'); } },
    Object.assign([], { status: 'released', markdown: 'secret' })];
  for (const outcome of malformed) {
    assert.throws(() => projectSearchOutcome(outcome as SearchOutcome), { name: 'Error', message: 'Search processing failed' });
  }
});
