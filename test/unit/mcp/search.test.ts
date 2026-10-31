import assert from 'node:assert/strict';
import { test } from 'node:test';
import { projectSearchOutcome, safeSearchFailure } from '../../../src/interfaces/mcp/search.ts';
import type { SearchOutcome } from '../../../src/pipelines/search/search-pipeline.ts';

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

const running = () => new AbortController().signal;

test('Given a search error with a fixed public message, when the failure is mapped, then the message and its completion status are kept', () => {
  for (const [message, status] of [
    ['Server busy. Try again later.', 'busy'], ['Invalid tool arguments', 'invalid_arguments'], ['Access denied', 'access_denied'],
    ['Search failed', 'search_failed'], ['Search processing failed', 'processing_failed'],
  ] as const) {
    assert.deepEqual(safeSearchFailure(new Error(message), running()), { status, message });
  }
});

test('Given a search error with private text or no Error type, when the failure is mapped, then only the fixed processing failure is returned', () => {
  for (const error of [new Error('PRIVATE failure'), new Error('toString'), 'Access denied', { message: 'Access denied' }, undefined, null]) {
    assert.deepEqual(safeSearchFailure(error, running()), { status: 'processing_failed', message: 'Search processing failed' });
  }
});

test('Given a search cancellation, when the failure is mapped, then the request is reported as cancelled', () => {
  assert.deepEqual(safeSearchFailure(new DOMException('PRIVATE cancel', 'AbortError'), running()), { status: 'cancelled', message: 'Request cancelled' });
  assert.deepEqual(safeSearchFailure(new Error('Access denied'), AbortSignal.abort()), { status: 'cancelled', message: 'Request cancelled' });
});

test('Given a search error with a throwing getter, when the failure is mapped, then the getter error stays private', () => {
  for (const field of ['name', 'message']) {
    const error = Object.defineProperty(new Error('Access denied'), field, { get() { throw new Error('PRIVATE getter'); } });
    assert.deepEqual(safeSearchFailure(error, running()), { status: 'processing_failed', message: 'Search processing failed' });
  }
});

test('Given a search error whose message getter aborts the request, when the failure is mapped, then cancellation wins', () => {
  const controller = new AbortController();
  const error = Object.defineProperty(new Error(), 'message', { get() { controller.abort(); return 'Access denied'; } });
  assert.deepEqual(safeSearchFailure(error, controller.signal), { status: 'cancelled', message: 'Request cancelled' });
});
