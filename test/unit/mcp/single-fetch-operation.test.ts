import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RequestContext } from '../../../src/auth/access-context.ts';
import { singleFetchOperation } from '../../../src/mcp/single-fetch-operation.ts';
import { executionContextOf } from '../../support/fixtures/execution-context.ts';

const context: RequestContext = { user: { authority: 'authority', subject: 'subject' }, tenantId: 'tenant', grants: [], permissions: ['product:access'] };

test('Given an execution context, when the hosted operation runs, then the same object and ID reach its collaborator', async () => {
  const execution = executionContextOf();
  const operation = singleFetchOperation(async (_url, trusted, received) => {
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
  const operation = singleFetchOperation(work);
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
    const operation = singleFetchOperation(async (_url, _context, execution) => {
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
