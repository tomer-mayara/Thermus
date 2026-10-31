import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RequestContext } from '../../../src/accounts/identity/access-context.ts';
import { createGetURLAsMarkdown, safeFetchFailure } from '../../../src/interfaces/mcp/get-url-as-markdown.ts';
import type { ExecutionContext } from '../../../src/pipelines/execution/execution-context.ts';
import { executionContextOf } from '../../support/fixtures/execution-context.ts';

const context: RequestContext = { user: { authority: 'authority', subject: 'subject' }, tenantId: 'tenant', grants: [], permissions: ['product:access'] };

for (const markdown of ['', '\n# Exact Markdown\n']) {
  test(`Given a released result ${JSON.stringify(markdown)}, when the MCP adapter runs, then it forwards the same execution context and returns exact text`, async (t) => {
    const execution = { ...executionContextOf(), operationId: 'D35803FB-2C25-4273-8967-99EED265721B' };
    const fetchPage = t.mock.fn(async (_url: string, _context: RequestContext, _execution: ExecutionContext) => ({ status: 'released' as const, markdown }));
    const operation = createGetURLAsMarkdown(fetchPage);

    assert.equal(await operation('HTTPS://Example.COM/Page', context, execution), markdown);
    assert.equal(fetchPage.mock.callCount(), 1);
    assert.deepEqual(fetchPage.mock.calls[0].arguments, ['HTTPS://Example.COM/Page', context, execution]);
    assert.equal(fetchPage.mock.calls[0].arguments[2], execution);
  });
}

for (const code of ['scan_failed', 'scan_limit'] as const) {
  test(`Given known incoming withholding ${code}, when the MCP adapter runs, then it returns exact empty text`, async () => {
    const operation = createGetURLAsMarkdown(async () => ({ status: 'withheld', code }));

    assert.equal(await operation('https://example.com/', context, executionContextOf()), '');
  });
}

for (const outcome of [
  { status: 'withheld', code: 'blocked' }, { status: 'withheld', code: 'private-code' },
  { status: 'private-status', markdown: 'private-markdown' }, { status: 'released', markdown: 42 },
]) {
  test(`Given malformed neutral ${outcome.status} ${outcome.code ?? ''}, when the MCP adapter runs, then it refuses payload with the fixed processing error`, async () => {
    const operation = createGetURLAsMarkdown(async () => outcome as never);

    await assert.rejects(operation('https://example.com/', context, executionContextOf()), { message: 'Page processing failed' });
  });
}

const running = () => new AbortController().signal;

test('Given a fetch error with a fixed public message, when the failure is mapped, then the message and its completion status are kept', () => {
  for (const [message, status] of [
    ['Server busy. Try again later.', 'busy'], ['Invalid tool arguments', 'invalid_arguments'], ['Access denied', 'access_denied'],
    ['Page fetch failed', 'fetch_failed'], ['Page processing failed', 'processing_failed'],
  ] as const) {
    assert.deepEqual(safeFetchFailure(new Error(message), running()), { status, message });
  }
});

test('Given a fetch error with private text or no Error type, when the failure is mapped, then only the fixed processing failure is returned', () => {
  for (const error of [new Error('PRIVATE failure'), new Error('toString'), 'Access denied', { message: 'Access denied' }, undefined, null]) {
    assert.deepEqual(safeFetchFailure(error, running()), { status: 'processing_failed', message: 'Page processing failed' });
  }
});

test('Given a fetch cancellation, when the failure is mapped, then the request is reported as cancelled', () => {
  assert.deepEqual(safeFetchFailure(new DOMException('PRIVATE cancel', 'AbortError'), running()), { status: 'cancelled', message: 'Request cancelled' });
  assert.deepEqual(safeFetchFailure(new Error('Access denied'), AbortSignal.abort()), { status: 'cancelled', message: 'Request cancelled' });
});

test('Given a fetch error with a throwing getter, when the failure is mapped, then the getter error stays private', () => {
  for (const field of ['name', 'message']) {
    const error = Object.defineProperty(new Error('Access denied'), field, { get() { throw new Error('PRIVATE getter'); } });
    assert.deepEqual(safeFetchFailure(error, running()), { status: 'processing_failed', message: 'Page processing failed' });
  }
});

test('Given a fetch error whose message changes after the first read, when the failure is mapped, then only the checked message is returned', () => {
  let reads = 0;
  const error = Object.defineProperty(new Error(), 'message', { get() { return reads++ === 0 ? 'Access denied' : 'PRIVATE changed message'; } });
  assert.deepEqual(safeFetchFailure(error, running()), { status: 'access_denied', message: 'Access denied' });
  assert.equal(reads, 1);
});

test('Given a fetch error whose message getter aborts the request, when the failure is mapped, then cancellation wins', () => {
  const controller = new AbortController();
  const error = Object.defineProperty(new Error(), 'message', { get() { controller.abort(); return 'Access denied'; } });
  assert.deepEqual(safeFetchFailure(error, controller.signal), { status: 'cancelled', message: 'Request cancelled' });
});
