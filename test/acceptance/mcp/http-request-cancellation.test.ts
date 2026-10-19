import { setImmediate } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mcpProtocolEras } from '../../support/drivers/mcp/mcp-protocol-eras.ts';
import { openSite } from '../../support/in-process/mcp-request-isolation-site.ts';
import { call, assertSuccess, assertRecord } from '../../support/dsl/mcp-request-isolation.ts';

for (const era of mcpProtocolEras) {
  test(`Given two trusted users overlap in ${era}, when only Alice cancels, then Bob succeeds with his context and Alice records cancellation`, { timeout: 5_000 }, async (t) => {
    const site = await openSite(t, era);
    const cancelled = new AbortController();
    const alice = await site.connect('alice', era === '2025-11-25' ? cancelled.signal : undefined);
    const bob = await site.connect('bob');
    const first = call(alice, 'alice', cancelled.signal);
    const rejected = assert.rejects(first);
    // Alice's operation starts before Bob's call, so that the order of the executions and of the step records is fixed.
    await site.pages.alice.started.promise;
    const second = call(bob, 'bob');
    const signals = await Promise.all([site.pages.alice.started.promise, site.pages.bob.started.promise]);
    assert.equal(site.operationExecutions[0].signal, signals[0]);
    assert.equal(site.operationExecutions[1].signal, signals[1]);
    cancelled.abort(new Error('private-alice-cancel-reason'));
    await rejected;
    await site.pages.alice.cancelled.promise;
    assert.equal(signals[0].aborted, true);
    assert.equal(signals[1].aborted, false);
    site.pages.bob.finish.resolve();
    assertSuccess(await second, 'bob');
    site.pages.alice.finish.resolve();
    await site.recorded[1].promise;
    assertRecord(site.records[0], 'bob', 'success');
    assertRecord(site.records[1], 'alice', 'cancelled');
    assert.deepEqual(site.steps.map(({ operationId, stepId, outcome }) => ({ operationId, stepId, outcome })), [
      ...site.operationExecutions.map(({ operationId }) => ({ operationId, stepId: 'outgoing.observe_request', outcome: 'allowed' })),
      { operationId: site.operationExecutions[1].operationId, stepId: 'incoming.process_html', outcome: 'allowed' },
    ]);
    assert.deepEqual(site.pipelineUrls, ['https://pages.example/bob']);
    assert.doesNotMatch(JSON.stringify(site.records), /private-alice-cancel-reason|Markdown for/);
  });

  test(`Given two trusted users have active calls in ${era}, when shutdown starts, then every peer cancels and shutdown waits for both cleanups`, { timeout: 5_000 }, async (t) => {
    const site = await openSite(t, era);
    const alice = await site.connect('alice');
    const bob = await site.connect('bob');
    const first = call(alice, 'alice').catch(() => undefined);
    const second = call(bob, 'bob').catch(() => undefined);
    const signals = await Promise.all([site.pages.alice.started.promise, site.pages.bob.started.promise]);
    let closed = false;
    const draining = site.listener.close();
    const closing = site.server.close().then(() => { closed = true; });
    await setImmediate();
    assert.ok(signals.every((signal) => signal.aborted), 'shutdown cancels both trusted users');
    assert.equal(closed, false);
    site.pages.bob.finish.resolve();
    await site.recorded[0].promise;
    assert.equal(closed, false);
    site.pages.alice.finish.resolve();
    await Promise.all([closing, draining]);
    await Promise.all([alice.close(), bob.close()]);
    await Promise.all([first, second]);
    assert.equal(site.records.length, 2);
    assertRecord(site.records[0], 'bob', 'cancelled');
    assertRecord(site.records[1], 'alice', 'cancelled');
    assert.deepEqual(site.pipelineUrls, []);
  });
}
