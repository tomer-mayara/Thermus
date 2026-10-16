import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import { Server, type Transport } from '@modelcontextprotocol/server';
import { MCPServer, type McpRequestLifetime } from '../../../src/mcp/mcp-server.ts';
import { mcpRequest } from '../../support/drivers/mcp/mcp-http-request.ts';
import { alice, contextFor, identityFor, resourceUrl } from '../../support/in-process/access-test-server.ts';

function defaultOptions(): NonNullable<ConstructorParameters<typeof MCPServer>[0]> {
  return {
    auth: {
      verifier: { verifyAccessToken: async () => identityFor(alice) },
      accessResolver: { resolve: async () => ({ allowed: true, context: contextFor(alice, 'tenant-a') }) },
      expectedResource: new URL(resourceUrl), resourceMetadataUrl: 'https://thermus.example/metadata',
    },
    reportFailure: () => {},
  };
}

async function requestLifetime() {
  let lifetime: McpRequestLifetime | undefined;
  const server = new MCPServer({
    ...defaultOptions(),
    buildServer: (_context, requestLifetime) => {
      lifetime = requestLifetime;
      const requestServer = new Server({ name: 'lifetime-double', version: '0.0.0' }, { capabilities: { tools: {} } });
      requestServer.setRequestHandler('tools/list', () => ({ tools: [] }));
      return requestServer;
    },
  });
  const response = await server.fetch(mcpRequest({ url: resourceUrl, token: 'token', method: 'tools/list' }));
  await response.text();
  return { server, lifetime };
}

test('Given owned work after the HTTP response, when close starts, then it aborts the lifetime and waits for cleanup with one shared close', async (t) => {
  const { server, lifetime } = await requestLifetime();
  const cleanup = Promise.withResolvers<void>();
  t.after(async () => { cleanup.resolve(); await server.close(); });
  assert.ok(lifetime, 'the request builder must receive an owned lifetime');
  const pending = lifetime.track(cleanup.promise);
  let finished = false;
  const closing = server.close();
  closing.then(() => { finished = true; });
  assert.equal(server.close(), closing);
  assert.equal(lifetime.signal.aborted, true);
  await setImmediate();
  assert.equal(finished, false);
  cleanup.resolve();
  await Promise.all([pending, closing, server.close()]);
});

test('Given a completed rejected task, when later close runs, then the old task is no longer part of active cleanup', async (t) => {
  const { server, lifetime } = await requestLifetime();
  t.after(() => server.close());
  assert.ok(lifetime);
  const failure = new Error('finished request failure');
  await assert.rejects(lifetime.track(Promise.reject(failure)), (error) => error === failure);
  await server.close();
});

test('Given a shutdown observer that also calls close, when shutdown starts, then the observer shares the same cleanup promise', async () => {
  const { server, lifetime } = await requestLifetime();
  assert.ok(lifetime);
  let observed: Promise<void> | undefined;
  lifetime.signal.addEventListener('abort', () => { observed = server.close(); }, { once: true });
  const closing = server.close();
  assert.equal(observed, closing);
  await closing;
});

test('Given cleanup that rejects during close, when all close callers finish, then each sees the cleanup error', async () => {
  const { server, lifetime } = await requestLifetime();
  assert.ok(lifetime);
  const cleanup = Promise.withResolvers<void>();
  const failedWork = lifetime.track(cleanup.promise);
  const failure = new Error('cleanup failed');
  const workRejected = assert.rejects(failedWork, (error) => error === failure);
  const firstClose = assert.rejects(server.close(), (error) => error === failure);
  const secondClose = assert.rejects(server.close(), (error) => error === failure);
  cleanup.reject(failure);
  await Promise.all([workRejected, firstClose, secondClose]);
});

for (const stage of ['verification', 'access'] as const) {
  test(`Given ${stage} in progress, when close starts, then it stops waiting for the provider call and does not start the next stage`, async (t) => {
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    let resolved = 0;
    let built = 0;
    const server = new MCPServer({
      ...defaultOptions(),
      auth: {
        verifier: { verifyAccessToken: async () => {
          if (stage === 'verification') { entered.resolve(); await release.promise; }
          return identityFor(alice);
        } },
        accessResolver: { resolve: async () => {
          resolved += 1;
          if (stage === 'access') { entered.resolve(); await release.promise; }
          return { allowed: true, context: contextFor(alice, 'tenant-a') };
        } },
        expectedResource: new URL(resourceUrl), resourceMetadataUrl: 'https://thermus.example/metadata',
      },
      buildServer: () => { built += 1; return new Server({ name: 'request-double', version: '0.0.0' }); },
      });
    t.after(async () => { release.resolve(); await server.close(); });
    const request = server.fetch(mcpRequest({ url: resourceUrl, token: 'token', method: 'tools/list' }));
    const rejected = assert.rejects(request, /closed|shut|abort/i);
    await entered.promise;
    let finished = false;
    const closing = server.close().then(() => { finished = true; });
    await setImmediate();
    assert.equal(finished, true);
    release.resolve();
    await Promise.all([rejected, closing]);
    assert.equal(resolved, stage === 'access' ? 1 : 0);
    assert.equal(built, 0);
  });
}

test('Given a verifier that starts shutdown before it returns, when its provider work is still pending, then close settles and access resolution never starts', async (t) => {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let closing: Promise<void> | undefined;
  let finished = false;
  let accesses = 0;
  const server = new MCPServer({
    ...defaultOptions(),
    auth: {
      verifier: { verifyAccessToken: async () => {
        closing = server.close().then(() => { finished = true; });
        entered.resolve();
        await release.promise;
        return identityFor(alice);
      } },
      accessResolver: { resolve: async () => { accesses += 1; return { allowed: true, context: contextFor(alice, 'tenant-a') }; } },
      expectedResource: new URL(resourceUrl), resourceMetadataUrl: 'https://thermus.example/metadata',
    },
  });
  t.after(() => release.resolve());
  const rejected = assert.rejects(server.fetch(mcpRequest({ url: resourceUrl, token: 'token', method: 'tools/list' })), /closed|shut|abort/i);
  await entered.promise;
  await setImmediate();
  assert.equal(finished, true);
  release.resolve();
  await Promise.all([closing, rejected]);
  assert.equal(accesses, 0);
});

test('Given an incomplete HTTP body, when close starts, then it cancels the body reader and settles active request work', { timeout: 2_000 }, async () => {
  const reading = Promise.withResolvers<void>();
  let cancellations = 0;
  const request = mcpRequest({ url: resourceUrl, token: 'token', method: 'tools/list' });
  const slow = new Request(request, { body: new ReadableStream({ pull: () => { reading.resolve(); }, cancel: () => { cancellations += 1; } }, { highWaterMark: 0 }), duplex: 'half' } as RequestInit);
  const server = new MCPServer({
    ...defaultOptions(),
  });
  const response = server.fetch(slow);
  await reading.promise;
  await server.close();
  await response;
  assert.equal(cancellations, 1);
});

for (const fails of [false, true]) {
  test(`Given a body reader with ${fails ? 'failing' : 'pending'} cancellation cleanup, when shutdown starts, then close awaits cleanup${fails ? ' and exposes its error' : ''}`, { timeout: 2_000 }, async (t) => {
    const reading = Promise.withResolvers<void>();
    const cleanupStarted = Promise.withResolvers<void>();
    const cleanup = Promise.withResolvers<void>();
    const failure = new Error('body cleanup failed');
    const request = mcpRequest({ url: resourceUrl, token: 'token', method: 'tools/list' });
    const slow = new Request(request, { body: new ReadableStream({
      pull: () => { reading.resolve(); },
      cancel: async () => { cleanupStarted.resolve(); await cleanup.promise; if (fails) throw failure; },
    }, { highWaterMark: 0 }), duplex: 'half' } as RequestInit);
    const server = new MCPServer({
      ...defaultOptions(),
      });
    t.after(() => cleanup.resolve());
    const response = server.fetch(slow);
    await reading.promise;
    let finished = false;
    const closing = server.close().then(() => undefined, (error: unknown) => error).finally(() => { finished = true; });
    await cleanupStarted.promise;
    await setImmediate();
    assert.equal(finished, false);
    cleanup.resolve();
    assert.equal(await closing, fails ? failure : undefined);
    await response;
  });
}

test('Given a request the SDK refuses before reading its body, when fetch settles, then the unread source is cancelled once', async () => {
  let cancellations = 0;
  const request = new Request(resourceUrl, {
    method: 'POST', headers: { Authorization: 'Bearer token', 'Content-Type': 'text/plain' },
    body: new ReadableStream({ cancel: () => { cancellations += 1; } }, { highWaterMark: 0 }), duplex: 'half',
  } as RequestInit);
  const server = new MCPServer({
    ...defaultOptions(),
  });
  const response = await server.fetch(request);
  assert.equal(response.status, 415);
  await setImmediate();
  assert.equal(cancellations, 1);
  await server.close();
});

test('Given a body source that fails while it is read, when the SDK refuses the request, then normal close does not report the input error as a cleanup error', async () => {
  const request = mcpRequest({ url: resourceUrl, token: 'token', method: 'tools/list' });
  const broken = new Request(request, { body: new ReadableStream({ start: (controller) => controller.error(new Error('input failed')) }), duplex: 'half' } as RequestInit);
  const server = new MCPServer({
    ...defaultOptions(),
  });
  assert.equal((await server.fetch(broken)).status, 400);
  await server.close();
});

test('Given a failing owned transport, when close is repeated, then it closes once and every caller sees the failure', async () => {
  const failure = new Error('transport close failed');
  let closes = 0;
  const transport: Transport = { start: async () => {}, send: async () => {}, close: async () => { closes += 1; throw failure; } };
  const server = new MCPServer();
  server.connect(transport);
  await Promise.all([
    assert.rejects(server.close(), (error) => error === failure),
    assert.rejects(server.close(), (error) => error === failure),
  ]);
  assert.equal(closes, 1);
});

test('Given a transport with pending cleanup, when close is concurrent and repeated, then all callers wait for its one close', async () => {
  const cleaned = Promise.withResolvers<void>();
  let closes = 0;
  const server = new MCPServer();
  server.connect({ start: async () => {}, send: async () => {}, close: async () => { closes += 1; await cleaned.promise; } });
  const first = server.close();
  const second = server.close();
  assert.equal(first, second);
  await setImmediate();
  assert.equal(closes, 1);
  cleaned.resolve();
  await Promise.all([first, second, server.close()]);
  assert.equal(closes, 1);
});

test('Given a closed server, when another request or transport arrives, then it refuses the work before verification or connection', async () => {
  let verifications = 0;
  let starts = 0;
  const server = new MCPServer({
    ...defaultOptions(),
    auth: {
      verifier: { verifyAccessToken: async () => { verifications += 1; return identityFor(alice); } },
      accessResolver: { resolve: async () => ({ allowed: true, context: contextFor(alice, 'tenant-a') }) },
      expectedResource: new URL(resourceUrl), resourceMetadataUrl: 'https://thermus.example/metadata',
    },
  });
  await server.close();
  await assert.rejects(server.fetch(mcpRequest({ url: resourceUrl, token: 'token', method: 'tools/list' })), /closed|shut/i);
  assert.throws(() => server.connect({ start: async () => { starts += 1; }, send: async () => {}, close: async () => {} }), /closed|shut/i);
  assert.equal(verifications, 0);
  assert.equal(starts, 0);
});

for (const legacy of [false, true]) {
  test(`Given a finished ${legacy ? 'legacy' : 'modern'} request, when its response completes, then its request server closes before application shutdown`, async () => {
    let closes = 0;
    const server = new MCPServer({
      ...defaultOptions(),
      buildServer: () => {
        const requestServer = new Server({ name: 'request-server-double', version: '0.0.0' }, { capabilities: { tools: {} } });
        requestServer.setRequestHandler('tools/list', () => ({ tools: [] }));
        const close = requestServer.close.bind(requestServer);
        requestServer.close = async () => { closes += 1; await close(); };
        return requestServer;
      },
      });
    const response = await server.fetch(listRequest(legacy));
    await response.text();
    await setImmediate();
    assert.equal(closes, 1);
    await Promise.all([server.close(), server.close()]);
    assert.equal(closes, 1);
  });

  test(`Given a ${legacy ? 'legacy' : 'modern'} request server whose close fails, when the SDK finishes the response, then later close still exposes the error and closes each resource once`, async () => {
    const failure = new Error('request server cleanup failed');
    const cleanupStarted = Promise.withResolvers<void>();
    const releaseCleanup = Promise.withResolvers<void>();
    let serverCloses = 0;
    let transportCloses = 0;
    const server = new MCPServer({
      ...defaultOptions(),
      buildServer: () => {
        const requestServer = new Server({ name: 'request-server-double', version: '0.0.0' }, { capabilities: { tools: {} } });
        requestServer.setRequestHandler('tools/list', () => ({ tools: [] }));
        const closeServer = requestServer.close.bind(requestServer);
        requestServer.close = async () => {
          serverCloses += 1;
          await closeServer();
          cleanupStarted.resolve();
          await releaseCleanup.promise;
          throw failure;
        };
        requestServer.onclose = () => { transportCloses += 1; };
        return requestServer;
      },
      });
    const response = await server.fetch(listRequest(legacy));
    await response.text();
    await cleanupStarted.promise;
    let finished = false;
    const rejected = assert.rejects(server.close(), (error) => error === failure).then(() => { finished = true; });
    await setImmediate();
    assert.equal(finished, false);
    releaseCleanup.resolve();
    await rejected;
    await assert.rejects(server.close(), (error) => error === failure);
    assert.equal(serverCloses, 1);
    assert.equal(transportCloses, 1);
  });
}

function listRequest(legacy: boolean): Request {
  return legacy ? new Request(resourceUrl, {
    method: 'POST', headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-11-25' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  }) : mcpRequest({ url: resourceUrl, token: 'token', method: 'tools/list' });
}
