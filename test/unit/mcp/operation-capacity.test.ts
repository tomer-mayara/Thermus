import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RequestContext } from '../../../src/auth/access-context.ts';
import { OperationCapacity } from '../../../src/mcp/operation-capacity.ts';
import { executionContextOf } from '../../support/fixtures/execution-context.ts';

const context: RequestContext = { user: { authority: 'authority', subject: 'subject' }, tenantId: 'tenant', grants: [], permissions: ['product:access'] };

test('Given an execution context, when the hosted operation runs, then the same object and ID reach its collaborator', async () => {
  const execution = executionContextOf();
  const operation = new OperationCapacity().wrap(async (_url, trusted, received) => {
    assert.equal(trusted, context);
    assert.equal(received, execution);
    return 'Markdown';
  });

  assert.equal(await operation('https://example.com', context, execution), 'Markdown');
});

test('Given an occupied slot and a cancelled caller, when the caller supplies an execution context, then cancellation wins over busy without starting work', async (t) => {
  const release = Promise.withResolvers<void>();
  t.after(() => release.resolve());
  const work = t.mock.fn(async () => { await release.promise; return 'Markdown'; });
  const operation = new OperationCapacity().wrap(work);
  const active = operation('https://example.com', context, executionContextOf());
  const controller = new AbortController();
  controller.abort();

  await assert.rejects(operation('https://example.com', context, executionContextOf(controller.signal)), { name: 'AbortError' });
  assert.equal(work.mock.callCount(), 1);
  release.resolve();
  assert.equal(await active, 'Markdown');
});

for (const outcome of ['success', 'failure', 'cancelled'] as const) {
  test(`Given an active shared fetch with ${outcome}, when a second call arrives before settlement, then it is refused without queuing and capacity returns only after settlement`, async () => {
    const release = Promise.withResolvers<void>();
    let calls = 0;
    const operation = new OperationCapacity().wrap(async (_url, _context, execution) => {
      calls += 1;
      if (calls === 1) {
        await release.promise;
        if (outcome === 'failure') throw new Error('private failure');
        execution.signal.throwIfAborted();
      }
      return 'Markdown';
    });
    const controller = new AbortController();
    const first = operation('https://example.com', context, executionContextOf(controller.signal));
    const observed = first.then((value) => value, (error: unknown) => error);
    if (outcome === 'cancelled') controller.abort();
    await assert.rejects(operation('https://example.com', context, executionContextOf()), { message: 'Server busy. Try again later.' });
    assert.equal(calls, 1);
    release.resolve();
    const result = await observed;
    if (outcome === 'success') assert.equal(result, 'Markdown');
    else assert.ok(result instanceof Error);
    assert.equal(await operation('https://example.com', context, executionContextOf()), 'Markdown');
    assert.equal(calls, 2);
  });
}

for (const firstTool of ['fetch', 'search'] as const) {
  for (const outcome of ['success', 'failure', 'abort'] as const) {
    test(`Given shared fetch and search capacity with ${firstTool} first and ${outcome}, when another call arrives during cleanup, then it is busy until cleanup settles`, async (t) => {
      const capacity = new OperationCapacity();
      const enteredCleanup = Promise.withResolvers<void>();
      const cleanup = Promise.withResolvers<void>();
      const controller = new AbortController();
      t.after(() => cleanup.resolve());
      let calls = 0;
      const run = async () => {
        calls += 1;
        try {
          if (outcome === 'failure') throw new Error('operation failed');
          if (outcome === 'abort') {
            controller.abort();
            controller.signal.throwIfAborted();
          }
        } finally {
          enteredCleanup.resolve();
          await cleanup.promise;
        }
      };
      const released = { status: 'released', markdown: 'Search results' } as const;
      const fetch = capacity.wrap(async () => { await run(); return 'Page'; });
      const search = capacity.wrap(async () => { await run(); return released; });
      const first = firstTool === 'fetch'
        ? fetch('https://example.com', context, executionContextOf(controller.signal))
        : search('query', context, executionContextOf(controller.signal));
      const observed = first.then(value => value, (error: unknown) => error);
      await enteredCleanup.promise;
      const second = firstTool === 'fetch' ? search : fetch;
      await assert.rejects(second('input', context, executionContextOf()), { message: 'Server busy. Try again later.' });
      assert.equal(calls, 1);
      cleanup.resolve();
      const result = await observed;
      if (outcome === 'success') assert.equal(result, firstTool === 'fetch' ? 'Page' : released);
      else assert.ok(result instanceof Error);
      assert.equal(await capacity.wrap(async () => released)('query', context, executionContextOf()), released);
      assert.equal(await capacity.wrap(async () => 'Page')('url', context, executionContextOf()), 'Page');
      assert.equal(calls, 1);
    });
  }
}

test('Given separate capacity owners, when one is busy, then the other can run', async (t) => {
  const release = Promise.withResolvers<void>();
  t.after(() => release.resolve());
  const first = new OperationCapacity().wrap(async () => { await release.promise; return 'First'; });
  const second = new OperationCapacity().wrap(async () => 'Second');
  const pending = first('url', context, executionContextOf());
  assert.equal(await second('query', context, executionContextOf()), 'Second');
  release.resolve();
  assert.equal(await pending, 'First');
});

test('Given a synchronous throw, when the operation fails, then capacity is available again', async () => {
  const capacity = new OperationCapacity();
  const failed = capacity.wrap(() => { throw new Error('synchronous failure'); });
  await assert.rejects(failed('input', context, executionContextOf()), { message: 'synchronous failure' });
  assert.equal(await capacity.wrap(async () => 'Next')('input', context, executionContextOf()), 'Next');
});
