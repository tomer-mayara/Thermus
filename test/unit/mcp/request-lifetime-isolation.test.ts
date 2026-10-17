import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import { Server } from '@modelcontextprotocol/server';
import type { RequestContext } from '../../../src/auth/access-context.ts';
import { MCPServer, type McpRequestLifetime } from '../../../src/mcp/mcp-server.ts';
import { mcpRequest } from '../../support/drivers/mcp/mcp-http-request.ts';
import { alice, bob, contextFor, identityFor, resourceUrl } from '../../support/in-process/access-test-server.ts';

for (const abortAlice of [false, true]) {
  test(`Given reverse overlapping request bindings, when ${abortAlice ? 'Alice aborts and shutdown follows' : 'shutdown starts'}, then frozen contexts and tracked lifetimes stay separate until both cleanups finish`, { timeout: 2_000 }, async (t) => {
    const resolvingAlice = Promise.withResolvers<void>();
    const releaseAliceResolution = Promise.withResolvers<void>();
    const aliceCleanup = Promise.withResolvers<void>();
    const bobCleanup = Promise.withResolvers<void>();
    const aliceAbort = new AbortController();
    const contexts = {
      [alice.subject]: contextFor(alice, 'tenant-a'),
      [bob.subject]: contextFor(bob, 'tenant-b'),
    };
    const bound: Array<{ context: RequestContext; lifetime: McpRequestLifetime }> = [];
    const server = new MCPServer({
      auth: {
        verifier: { verifyAccessToken: async (token) => identityFor(token === 'alice-token' ? alice : bob) },
        accessResolver: { resolve: async (user) => {
          if (user.subject === alice.subject) {
            resolvingAlice.resolve();
            await releaseAliceResolution.promise;
          }
          const context = contexts[user.subject];
          assert.ok(context);
          return { allowed: true, context };
        } },
        expectedResource: new URL(resourceUrl), resourceMetadataUrl: 'https://thermus.example/metadata',
      },
      buildServer: (context, lifetime) => {
        bound.push({ context, lifetime });
        lifetime.track(context.user.subject === alice.subject ? aliceCleanup.promise : bobCleanup.promise);
        const requestServer = new Server({ name: 'request-lifetime-double', version: '0.0.0' }, { capabilities: { tools: {} } });
        requestServer.setRequestHandler('tools/list', () => ({ tools: [] }));
        return requestServer;
      },
      reportFailure: () => {},
    });
    t.after(async () => {
      releaseAliceResolution.resolve();
      aliceCleanup.resolve();
      bobCleanup.resolve();
      await server.close();
    });
    const first = server.fetch(mcpRequest({ url: resourceUrl, token: 'alice-token', method: 'tools/list', signal: aliceAbort.signal }));
    await resolvingAlice.promise;
    const second = await server.fetch(mcpRequest({ url: resourceUrl, token: 'bob-token', method: 'tools/list' }));
    await second.text();
    releaseAliceResolution.resolve();
    await (await first).text();

    assert.deepEqual(bound.map(({ context }) => context.user.subject), [bob.subject, alice.subject]);
    const [bobBound, aliceBound] = bound;
    assert.ok(bobBound);
    assert.ok(aliceBound);
    assert.notEqual(aliceBound.lifetime.signal, bobBound.lifetime.signal);
    assert.notEqual(aliceBound.context, contexts[alice.subject]);
    assert.notEqual(bobBound.context, contexts[bob.subject]);
    assert.deepEqual(aliceBound.context, contexts[alice.subject]);
    assert.deepEqual(bobBound.context, contexts[bob.subject]);
    for (const { context } of bound) {
      for (const value of [context, context.user, context.grants, context.grants[0], context.grants[0]?.permissions, context.permissions]) {
        assert.equal(Object.isFrozen(value), true);
      }
    }
    assert.equal(aliceBound.lifetime.signal.aborted, false);
    assert.equal(bobBound.lifetime.signal.aborted, false);
    if (abortAlice) {
      const reason = new Error('Alice request cancelled');
      aliceAbort.abort(reason);
      assert.equal(aliceBound.lifetime.signal.aborted, true);
      assert.equal(aliceBound.lifetime.signal.reason, reason);
      assert.equal(bobBound.lifetime.signal.aborted, false);
    }
    let closed = false;
    const closing = server.close().then(() => { closed = true; });
    assert.equal(aliceBound.lifetime.signal.aborted, true);
    assert.equal(bobBound.lifetime.signal.aborted, true);
    await setImmediate();
    assert.equal(closed, false);
    bobCleanup.resolve();
    await setImmediate();
    assert.equal(closed, false);
    aliceCleanup.resolve();
    await closing;
    assert.equal(closed, true);
    assert.equal(aliceBound.context.tenantId, 'tenant-a');
    assert.equal(bobBound.context.tenantId, 'tenant-b');
  });
}

test('Given a modern tool call that waits for cancellation, when its request signal aborts, then MCPServer.fetch returns the HTTP response before the owned cleanup ends and close waits for that cleanup', { timeout: 2_000 }, async (t) => {
  const started = Promise.withResolvers<void>();
  const cleanup = Promise.withResolvers<void>();
  const cancelled = new AbortController();
  const server = new MCPServer({
    auth: {
      verifier: { verifyAccessToken: async () => identityFor(alice) },
      accessResolver: { resolve: async () => ({ allowed: true, context: contextFor(alice, 'tenant-a') }) },
      expectedResource: new URL(resourceUrl), resourceMetadataUrl: 'https://thermus.example/metadata',
    },
    buildServer: (_context, lifetime) => {
      const requestServer = new Server({ name: 'cancelled-call-double', version: '0.0.0' }, { capabilities: { tools: {} } });
      requestServer.setRequestHandler('tools/call', () => lifetime.track((async () => {
        started.resolve();
        await new Promise((resolve) => lifetime.signal.addEventListener('abort', resolve, { once: true }));
        await cleanup.promise;
        return { content: [] };
      })()));
      return requestServer;
    },
    reportFailure: () => {},
  });
  t.after(async () => { cleanup.resolve(); await server.close(); });
  const response = server.fetch(mcpRequest({ url: resourceUrl, token: 'token', method: 'tools/call', params: { name: 'wait', arguments: {} }, signal: cancelled.signal }));
  await started.promise;

  cancelled.abort();
  const released = await response;
  let finished = false;
  const closing = server.close().then(() => { finished = true; });
  await setImmediate();

  assert.equal(released.body, null);
  assert.equal(finished, false);
  cleanup.resolve();
  await closing;
});
