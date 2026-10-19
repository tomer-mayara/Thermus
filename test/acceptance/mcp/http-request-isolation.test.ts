import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mcpProtocolEras } from '../../support/drivers/mcp/mcp-protocol-eras.ts';
import { openSite } from '../../support/in-process/mcp-request-isolation-site.ts';
import { call, assertSuccess, assertRecord } from '../../support/dsl/mcp-request-isolation.ts';

for (const era of mcpProtocolEras) {
  test(`Given two trusted users overlap in ${era}, when calls finish in reverse order, then each result and record keeps its context`, { timeout: 5_000 }, async (t) => {
    const site = await openSite(t, era);
    const alice = await site.connect('alice');
    const bob = await site.connect('bob');
    const first = call(alice, 'alice');
    await site.pages.alice.started.promise;
    const second = call(bob, 'bob');
    const signals = await Promise.all([site.pages.alice.started.promise, site.pages.bob.started.promise]);
    assert.notEqual(signals[0], signals[1]);
    site.pages.bob.finish.resolve();
    assertSuccess(await second, 'bob');
    site.pages.alice.finish.resolve();
    assertSuccess(await first, 'alice');
    assert.equal(site.records.length, 2);
    assertRecord(site.records[0], 'bob', 'success');
    assertRecord(site.records[1], 'alice', 'success');
    assert.equal(site.records[0].operationId, site.operationExecutions[1].operationId);
    assert.equal(site.records[1].operationId, site.operationExecutions[0].operationId);
    assert.notEqual(site.operationExecutions[0].operationId, site.operationExecutions[1].operationId);
    assert.deepEqual(site.steps.map(({ operationId, stepId, outcome }) => ({ operationId, stepId, outcome })), [
      ...site.operationExecutions.map(({ operationId }) => ({ operationId, stepId: 'outgoing.observe_request', outcome: 'allowed' })),
      { operationId: site.operationExecutions[1].operationId, stepId: 'incoming.process_html', outcome: 'allowed' },
      { operationId: site.operationExecutions[0].operationId, stepId: 'incoming.process_html', outcome: 'allowed' },
    ]);
    assert.equal(site.operationExecutions[0].signal, signals[0]);
    assert.equal(site.operationExecutions[1].signal, signals[1]);
    assert.deepEqual(site.operationContexts.map((context) => [context.user.subject, context.tenantId]), [['alice', 'alice-tenant'], ['bob', 'bob-tenant']]);
    assert.ok(site.operationContexts.every((context) => Object.isFrozen(context)));
  });
}
