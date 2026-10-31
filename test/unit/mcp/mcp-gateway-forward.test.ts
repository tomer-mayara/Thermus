import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import type { GatewayRoute } from '../../../src/interfaces/mcp/mcp-gateway-tenants.ts';
import { context, controlledBody, fetchCall, gatewayOf, internalUrl, liveRoute, organizationId, post } from './fixtures/gateway-harness.ts';

test('Given a live tenant, when a call is forwarded, then the tenant gets the method, the body, the path and query, the client headers without the hop-by-hop headers, a cookie, or a client context, and the signed context of the access', async (t) => {
  const { forward, calls, signed } = gatewayOf(t);
  const body = JSON.stringify(fetchCall);

  await forward(post(body, {
    'Thermus-Access': 'client-context', TE: 'trailers', Trailer: 'X-Trailer', 'Keep-Alive': 'timeout=5', 'Transfer-Encoding': 'chunked',
    Upgrade: 'websocket', Connection: 'keep-alive, X-Hop', 'X-Hop': 'hop-value', 'Proxy-Authorization': 'Basic secret', Cookie: 'session=private',
    'Mcp-Method': 'tools/call', 'Mcp-Name': 'getURLAsMarkdown', 'MCP-Protocol-Version': '2026-07-28',
  }, '/mcp?probe=1'));

  const [call] = calls;
  assert.equal(call?.url, `${internalUrl}/mcp?probe=1`);
  assert.equal(call?.init.method, 'POST');
  assert.equal(new TextDecoder().decode(call?.init.body as Uint8Array), body);
  assert.equal(call?.init.redirect, 'manual');
  const headers = new Headers(call?.init.headers);
  assert.deepEqual([...headers.keys()].sort(), ['accept', 'authorization', 'content-type', 'mcp-method', 'mcp-name', 'mcp-protocol-version', 'thermus-access']);
  assert.equal(headers.get('Thermus-Access'), 'signed-context-1');
  assert.equal(headers.get('Authorization'), 'Bearer connect-token');
  assert.deepEqual(signed, [{ claims: { authority: 'workos:client_A', subject: 'user_A', name: 'Ann', organizationId, grants: context.grants }, token: 'connect-token' }]);
});

test('Given a GET stream or a notification, when it is forwarded, then the tenant gets it with the signed context, and the client gets the status of the tenant', async (t) => {
  const { forward, calls, upstream } = gatewayOf(t);
  upstream.answer = async ({ init }) => new Response(null, { status: init.method === 'GET' ? 405 : 202, headers: init.method === 'GET' ? { Allow: 'POST' } : {} });

  const stream = await forward(new Request('https://thermus.example/mcp', { headers: { Accept: 'text/event-stream', Authorization: 'Bearer connect-token' } }));
  const cancelled = await forward(post({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 7, reason: 'AbortError' } }));

  assert.deepEqual([stream.status, stream.headers.get('Allow'), cancelled.status], [405, 'POST', 202]);
  assert.deepEqual(calls.map(({ init }) => [init.method, init.body === undefined, new Headers(init.headers).get('Thermus-Access')]), [['GET', true, 'signed-context-1'], ['POST', false, 'signed-context-2']]);
});

test('Given an answer of the tenant, when it streams, then each chunk reaches the client as it comes, the answer headers lose their hop-by-hop and length headers, and the activity is recorded once', async (t) => {
  const { forward, upstream, registry, tracked } = gatewayOf(t);
  const answer = controlledBody();
  upstream.answer = async () => new Response(answer.body, { status: 200, headers: { 'Content-Type': 'text/event-stream', Connection: 'keep-alive', 'Keep-Alive': 'timeout=5', 'Content-Length': '999', 'Content-Encoding': 'gzip', 'X-Tenant': 'kept' } });
  answer.send('event: message\ndata: first\n\n');

  const response = await forward(post(fetchCall));
  const reader = response.body?.getReader();
  const first = await reader?.read();
  answer.send('event: message\ndata: second\n\n');
  const second = await reader?.read();
  answer.end();
  const end = await reader?.read();
  await Promise.all(tracked);

  assert.deepEqual([response.status, response.headers.get('Content-Type'), response.headers.get('X-Tenant')], [200, 'text/event-stream', 'kept']);
  for (const name of ['connection', 'keep-alive', 'content-length', 'content-encoding']) assert.equal(response.headers.get(name), null, name);
  assert.deepEqual([new TextDecoder().decode(first?.value), new TextDecoder().decode(second?.value), end?.done], ['event: message\ndata: first\n\n', 'event: message\ndata: second\n\n', true]);
  assert.deepEqual(registry.active, [organizationId]);
});

test('Given a client that goes away before the tenant answers, when the request signal aborts, then the gateway aborts the pending fetch of the tenant and reports no restart', async (t) => {
  const { forward, upstream, log, calls } = gatewayOf(t);
  const fetchAborted = Promise.withResolvers<void>();
  upstream.answer = ({ init }) => new Promise((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => { fetchAborted.resolve(); reject(init.signal?.reason); }, { once: true });
  });
  const client = new AbortController();

  const forwarded = forward(post(fetchCall), client.signal).catch((error: unknown) => error);
  while (calls.length === 0) await setImmediate();
  client.abort(new DOMException('The client went away', 'AbortError'));
  await fetchAborted.promise;
  const outcome = await forwarded;

  assert.ok(outcome instanceof DOMException);
  assert.deepEqual(log.lines, []);
});

test('Given a client that goes away after the answer started, when the request signal aborts, then the gateway cancels the answer body of the tenant and reports no restart', async (t) => {
  const { forward, upstream, log, tracked } = gatewayOf(t);
  const answer = controlledBody();
  upstream.answer = async () => new Response(answer.body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
  answer.send('event: message\ndata: first\n\n');
  const client = new AbortController();

  await forward(post(fetchCall), client.signal);
  client.abort(new DOMException('The client went away', 'AbortError'));
  await answer.cancelled;
  await Promise.all(tracked);

  assert.deepEqual(log.lines, []);
});

test('Given a client that cancels the answer stream, when the stream is cancelled, then the gateway cancels the answer body of the tenant', async (t) => {
  const { forward, upstream } = gatewayOf(t);
  const answer = controlledBody();
  upstream.answer = async () => new Response(answer.body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
  answer.send('event: message\ndata: first\n\n');

  const response = await forward(post(fetchCall));
  await response.body?.cancel(new Error('The bridge stopped'));

  assert.ok(await answer.cancelled);
});

const restarts: ReadonlyArray<readonly [string, (body: ReturnType<typeof controlledBody>) => Promise<Response>, string]> = [
  ['the tenant answers HTTP 502', async () => new Response('<html>Bad Gateway</html>', { status: 502 }), 'http-502'],
  ['the connection resets before the answer', async () => { throw new TypeError('fetch failed'); }, 'connection'],
  ['the connection resets before the first answer byte', async (body) => { body.fail(); return new Response(body.body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }); }, 'connection'],
];

for (const [label, answer, cause] of restarts) {
  test(`Given ${label}, when a tool call fails, then the client gets one tool error with the restart words for its JSON-RPC id, and one operator report`, async (t) => {
    const { forward, upstream, log, registry } = gatewayOf(t);
    const body = controlledBody();
    upstream.answer = () => answer(body);

    const response = await forward(post(fetchCall));

    assert.deepEqual([response.status, response.headers.get('Content-Type')], [200, 'application/json']);
    assert.deepEqual(await response.json(), { jsonrpc: '2.0', id: 7, result: { content: [{ type: 'text', text: 'Server restarted. Try again in a minute.' }], isError: true, resultType: 'complete' } });
    assert.equal(log.lines.length, 1);
    assert.equal(log.lines[0], `ERROR MCP gateway tenant restart: {"organizationId":"org_A","phase":"before-answer","cause":"${cause}"}`);
    assert.deepEqual(registry.active, []);
  });
}

// Records SO-03 and SO-12: the private address of a new tenant refuses connections for about 76 s after its live record.
const coldStart: GatewayRoute = { ...liveRoute, sinceChangeMs: 30_000 };
const startingWords = 'Your workspace is not ready yet. Try again in 15 seconds.';

for (const [label, answer, cause] of restarts) {
  test(`Given a live row that changed 30 s ago and ${label}, when a tool call fails, then it is the cold start of the tenant: the client gets one tool error with the starting words, and the log gets one info line and no operator report`, async (t) => {
    const { forward, upstream, log, registry } = gatewayOf(t, coldStart);
    const body = controlledBody();
    upstream.answer = () => answer(body);

    const response = await forward(post(fetchCall));

    assert.deepEqual(await response.json(), { jsonrpc: '2.0', id: 7, result: { content: [{ type: 'text', text: startingWords }], isError: true, resultType: 'complete' } });
    assert.deepEqual(log.lines, [`INFO MCP gateway tenant starting: {"organizationId":"org_A","cause":"${cause}","secondsSinceLive":30}`]);
    assert.deepEqual(registry.active, []);
  });
}

test('Given live rows that changed just under and exactly 2 minutes ago, when the connection fails before the first answer byte, then the first is a cold start and the second a restart', async (t) => {
  const lines: string[] = [];
  for (const sinceChangeMs of [119_999, 120_000]) {
    const { forward, upstream, log } = gatewayOf(t, { ...liveRoute, sinceChangeMs });
    upstream.answer = async () => { throw new TypeError('fetch failed'); };
    await (await forward(post(fetchCall))).text();
    lines.push(...log.lines);
  }

  assert.deepEqual(lines, [
    'INFO MCP gateway tenant starting: {"organizationId":"org_A","cause":"connection","secondsSinceLive":119.9}',
    'ERROR MCP gateway tenant restart: {"organizationId":"org_A","phase":"before-answer","cause":"connection"}',
  ]);
});

test('Given a cold start, when the request is not a tool call, then each request gets a JSON-RPC error with the starting words, and a body without a request gets 503 with Retry-After: 15', async (t) => {
  const { forward, upstream } = gatewayOf(t, coldStart);
  upstream.answer = async () => { throw new TypeError('fetch failed'); };

  const listed = await forward(post({ jsonrpc: '2.0', id: 'list-1', method: 'tools/list' }));
  const notification = await forward(post({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 7 } }));

  assert.deepEqual(await listed.json(), { jsonrpc: '2.0', id: 'list-1', error: { code: -32603, message: startingWords } });
  assert.deepEqual([notification.status, notification.headers.get('Retry-After')], [503, '15']);
  assert.deepEqual(await notification.json(), { error: 'temporarily_unavailable', error_description: startingWords });
});

test('Given a live row that changed 30 s ago and an answer stream that started, when the connection of the tenant resets, then the tenant answered before, so it is a restart with one operator report', async (t) => {
  const { forward, upstream, log, tracked } = gatewayOf(t, coldStart);
  const answer = controlledBody();
  upstream.answer = async () => new Response(answer.body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
  answer.send('event: message\ndata: first\n\n');

  const response = await forward(post(fetchCall));
  const reader = response.body?.getReader();
  await reader?.read();
  answer.fail();
  await reader?.read();
  await Promise.all(tracked);

  assert.deepEqual(log.lines, ['ERROR MCP gateway tenant restart: {"organizationId":"org_A","phase":"during-answer","cause":"connection"}']);
});

test('Given a tenant failure before the first answer byte, when the request is not a tool call, then each request gets a JSON-RPC error with the restart words, and a body without a request gets 503 with Retry-After: 60', async (t) => {
  const { forward, upstream } = gatewayOf(t);
  upstream.answer = async () => { throw new TypeError('fetch failed'); };

  const listed = await forward(post({ jsonrpc: '2.0', id: 'list-1', method: 'tools/list' }));
  const batch = await forward(post([fetchCall, { jsonrpc: '2.0', method: 'notifications/initialized' }, { jsonrpc: '2.0', id: 8, method: 'tools/list' }]));
  const notification = await forward(post({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 7 } }));

  assert.deepEqual(await listed.json(), { jsonrpc: '2.0', id: 'list-1', error: { code: -32603, message: 'Server restarted. Try again in a minute.' } });
  assert.deepEqual((await batch.json() as Array<{ id: unknown }>).map(({ id }) => id), [7, 8]);
  assert.deepEqual([notification.status, notification.headers.get('Retry-After')], [503, '60']);
  assert.deepEqual(await notification.json(), { error: 'temporarily_unavailable', error_description: 'Server restarted. Try again in a minute.' });
});

test('Given an answer stream that started, when the connection of the tenant resets, then the gateway ends the stream and writes one operator report', async (t) => {
  const { forward, upstream, log, tracked } = gatewayOf(t);
  const answer = controlledBody();
  upstream.answer = async () => new Response(answer.body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
  answer.send('event: message\ndata: first\n\n');

  const response = await forward(post(fetchCall));
  const reader = response.body?.getReader();
  await reader?.read();
  answer.fail();
  const end = await reader?.read();
  await Promise.all(tracked);

  assert.equal(end?.done, true);
  assert.deepEqual(log.lines, ['ERROR MCP gateway tenant restart: {"organizationId":"org_A","phase":"during-answer","cause":"connection"}']);
});

test('Given a body above the request body limit of the MCP SDK, when it arrives, then the gateway answers 413 as the SDK does and forwards nothing', async (t) => {
  const { forward, calls } = gatewayOf(t);

  const response = await forward(post(`{"padding":"${'x'.repeat(4 * 1024 * 1024)}"}`));

  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { jsonrpc: '2.0', error: { code: -32000, message: 'Payload Too Large: Request body must not exceed 4194304 bytes' }, id: null });
  assert.deepEqual(calls, []);
});

test('Given a tenant answer of 500 or more, when it ends, then the gateway passes it through and records no activity', async (t) => {
  const { forward, upstream, registry, tracked } = gatewayOf(t);
  upstream.answer = async () => Response.json({ error: 'server_error' }, { status: 500 });

  const response = await forward(post(fetchCall));
  await response.text();
  await Promise.all(tracked);

  assert.equal(response.status, 500);
  assert.deepEqual(registry.active, []);
});
