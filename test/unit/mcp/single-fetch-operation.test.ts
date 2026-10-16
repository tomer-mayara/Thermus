import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RequestContext } from '../../../src/auth/access-context.ts';
import { singleFetchOperation } from '../../../src/mcp/single-fetch-operation.ts';

const context: RequestContext = { user: { authority: 'authority', subject: 'subject' }, tenantId: 'tenant', grants: [], permissions: ['product:access'] };

for (const outcome of ['success', 'failure', 'cancelled'] as const) {
  test(`Given an active shared fetch with ${outcome}, when a second call arrives before settlement, then it is refused without queuing and capacity returns only after settlement`, async () => {
    const release = Promise.withResolvers<void>();
    let calls = 0;
    const operation = singleFetchOperation(async (_url, _context, signal) => {
      calls += 1;
      if (calls === 1) {
        await release.promise;
        if (outcome === 'failure') throw new Error('private failure');
        signal.throwIfAborted();
      }
      return 'Markdown';
    });
    const controller = new AbortController();
    const first = operation('https://example.com', context, controller.signal);
    const observed = first.then((value) => value, (error: unknown) => error);
    if (outcome === 'cancelled') controller.abort();
    await assert.rejects(operation('https://example.com', context, new AbortController().signal), { message: 'Server busy. Try again later.' });
    assert.equal(calls, 1);
    release.resolve();
    const result = await observed;
    if (outcome === 'success') assert.equal(result, 'Markdown');
    else assert.ok(result instanceof Error);
    assert.equal(await operation('https://example.com', context, new AbortController().signal), 'Markdown');
    assert.equal(calls, 2);
  });
}
