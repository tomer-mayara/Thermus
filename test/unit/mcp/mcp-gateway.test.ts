import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import type { RequestContext } from '../../../src/accounts/identity/access-context.ts';
import type { AccessContextClaims } from '../../../src/accounts/identity/signed-access-context.ts';
import { McpGateway, type GatewayResume, type GatewayRoute, type GatewayTenantRequest } from '../../../src/interfaces/mcp/mcp-gateway.ts';
import type { McpForwardedRequest } from '../../../src/interfaces/mcp/mcp-server.ts';
import { OperatorLogSpy } from '../../support/doubles/application/operator-log-spy.ts';

// The gateway step of MCPServer (SO-05) with its collaborators replaced: the registry port, the context signer, and
// the fetch of the tenant upstream.

const organizationId = 'org_A';
const internalUrl = 'http://thermus-tenant-org-a:8080';
const context: RequestContext = Object.freeze({
  user: Object.freeze({ authority: 'workos:client_A', subject: 'user_A', name: 'Ann', selectedOrganizationId: organizationId }),
  tenantId: `workos:client_A:${organizationId}`,
  organizationId,
  grants: Object.freeze([Object.freeze({ role: 'user', permissions: Object.freeze(['product:access']) })]),
  permissions: Object.freeze(['product:access']),
});
const fetchCall = { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'getURLAsMarkdown', arguments: { url: 'https://source.example/', reason: 'Read it' } } };

interface UpstreamCall {
  readonly url: string;
  readonly init: RequestInit;
}

function gatewayOf(t: TestContext, route: GatewayRoute = { status: 'found', state: 'live', internalUrl }) {
  const log = new OperatorLogSpy();
  const signed: Array<{ readonly claims: AccessContextClaims; readonly token: string }> = [];
  const registry = {
    route,
    request: { status: 'requested' } as GatewayTenantRequest,
    resume: { status: 'sent' } as GatewayResume,
    finds: [] as string[],
    requests: [] as string[],
    resumes: [] as string[],
    active: [] as string[],
  };
  const tenants = {
    find: async (organization: string) => { registry.finds.push(organization); return registry.route; },
    request: async (organization: string) => { registry.requests.push(organization); return registry.request; },
    resume: async (organization: string) => { registry.resumes.push(organization); return registry.resume; },
    recordActive: (organization: string) => { registry.active.push(organization); },
  };
  const signer = { sign: async (claims: AccessContextClaims, token: string) => { signed.push({ claims, token }); return `signed-context-${signed.length}`; } };
  const calls: UpstreamCall[] = [];
  const upstream = { answer: async (_call: UpstreamCall): Promise<Response> => Response.json({ jsonrpc: '2.0', id: 7, result: { content: [] } }) };
  t.mock.method(globalThis, 'fetch', (async (input: string | URL | Request, init: RequestInit = {}) => {
    const call = { url: String(input), init };
    calls.push(call);
    return upstream.answer(call);
  }) as typeof fetch);
  const gateway = new McpGateway({ signer, tenants, logger: log });
  const tracked: Array<Promise<unknown>> = [];
  const forward = (request: Request, signal: AbortSignal = new AbortController().signal) => {
    const forwarded: McpForwardedRequest = { context, bearerToken: 'connect-token', lifetime: { signal, track: (task) => { tracked.push(task); return task; } } };
    return gateway.forward(request, forwarded);
  };
  return { gateway, log, signed, registry, calls, upstream, forward, tracked };
}

function post(body: unknown, headers: Record<string, string> = {}, path = '/mcp'): Request {
  return new Request(`https://thermus.example${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: 'Bearer connect-token', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function refusalOf(response: Response) {
  return { status: response.status, retryAfter: response.headers.get('Retry-After'), body: await response.json() as Record<string, unknown> };
}

// A body stream whose chunks the test sends, and whose cancel the test sees.
function controlledBody() {
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  const cancelled = Promise.withResolvers<unknown>();
  const body = new ReadableStream<Uint8Array>({ start(started) { controller = started; }, cancel(reason) { cancelled.resolve(reason); } });
  return {
    body,
    cancelled: cancelled.promise,
    send: (text: string) => controller?.enqueue(new TextEncoder().encode(text)),
    end: () => { try { controller?.close(); } catch { /* The test ended this body before. */ } },
    fail: () => controller?.error(new TypeError('terminated')),
  };
}

const starting = 'Your workspace is not ready yet. Try again in 15 seconds.';
const unavailable = 'The service is temporarily unavailable. Try again in 15 seconds.';
const stateAnswers: ReadonlyArray<readonly [string, GatewayRoute, number, string | null, string]> = [
  ['requested', { status: 'found', state: 'requested', internalUrl: null }, 503, '15', starting],
  ['creating', { status: 'found', state: 'creating', internalUrl: null }, 503, '15', starting],
  ['deploying', { status: 'found', state: 'deploying', internalUrl: null }, 503, '15', starting],
  ['suspended', { status: 'found', state: 'suspended', internalUrl: null }, 503, '60', 'Your workspace is restarting after a pause. Try again in a minute.'],
  ['failed', { status: 'found', state: 'failed', internalUrl: null }, 503, null, 'Workspace setup failed. We have been notified and will fix it.'],
  ['deleted', { status: 'found', state: 'deleted', internalUrl: null }, 503, null, 'Your workspace is not available. Contact Thermus support.'],
  ['a live row without an address', { status: 'found', state: 'live', internalUrl: null }, 503, '15', unavailable],
  ['an unavailable registry copy', { status: 'unavailable' }, 503, '15', unavailable],
];

for (const [label, route, status, retryAfter, words] of stateAnswers) {
  test(`Given ${label}, when a call arrives, then the gateway answers ${status} with Retry-After ${retryAfter ?? 'absent'} and its words, forwards nothing, and writes one log line`, async (t) => {
    const { forward, calls, log } = gatewayOf(t, route);

    const refusal = await refusalOf(await forward(post(fetchCall)));

    assert.deepEqual(refusal, { status, retryAfter, body: { error: 'temporarily_unavailable', error_description: words } });
    assert.deepEqual(calls, []);
    assert.equal(log.lines.length, 1, log.lines.join('\n'));
    assert.match(log.lines[0] ?? '', /^(INFO|ERROR) MCP gateway refusal: \{"organizationId":"org_A"/);
  });
}

test('Given a suspended row, when calls arrive, then each asks the registry to resume the tenant one time and gets 503 with Retry-After: 60', async (t) => {
  const { forward, registry } = gatewayOf(t, { status: 'found', state: 'suspended', internalUrl: null });
  registry.resume = { status: 'pending' };

  const answers = await Promise.all([forward(post(fetchCall)), forward(post(fetchCall))]);

  assert.deepEqual(answers.map((answer) => [answer.status, answer.headers.get('Retry-After')]), [[503, '60'], [503, '60']]);
  assert.deepEqual(registry.resumes, [organizationId, organizationId]);
});

test('Given a resume that fails, when a call arrives, then the client gets 503 with Retry-After: 60 and the one log line is an operator report with the reason', async (t) => {
  const { forward, registry, log } = gatewayOf(t, { status: 'found', state: 'suspended', internalUrl: null });
  registry.resume = { status: 'failed', reason: 'Render answered 429' };

  const answer = await forward(post(fetchCall));

  assert.deepEqual([answer.status, answer.headers.get('Retry-After')], [503, '60']);
  assert.equal(log.lines.length, 1);
  assert.match(log.lines[0] ?? '', /^ERROR MCP gateway refusal: .*"reason":"resuming".*"resume":"failed".*"resumeFailure":"Render answered 429"/);
});

test('Given a failed row, when two calls arrive, then the first refusal line is an operator report and the second is not', async (t) => {
  const { forward, log } = gatewayOf(t, { status: 'found', state: 'failed', internalUrl: null });

  await forward(post(fetchCall));
  await forward(post(fetchCall));

  assert.deepEqual(log.lines.map((line) => line.split(' ')[0]), ['ERROR', 'INFO']);
});

const requestAnswers: ReadonlyArray<readonly [GatewayTenantRequest, number, string | null, string, string]> = [
  [{ status: 'requested' }, 503, '15', starting, 'starting'],
  [{ status: 'full' }, 503, null, 'All free workspaces are in use. Try again later.', 'capacity'],
  [{ status: 'unavailable' }, 503, '15', unavailable, 'registry-unavailable'],
  [{ status: 'present', state: 'creating' }, 503, '15', starting, 'starting'],
  [{ status: 'present', state: 'live' }, 503, '15', unavailable, 'registry-unavailable'],
];

for (const [request, status, retryAfter, words, reason] of requestAnswers) {
  test(`Given no row and a tenant request that gives ${request.status}${'state' in request ? ` ${request.state}` : ''}, when a call arrives, then the gateway answers ${status} with its words`, async (t) => {
    const { forward, registry, calls, log } = gatewayOf(t, { status: 'absent' });
    registry.request = request;

    const refusal = await refusalOf(await forward(post(fetchCall)));

    assert.deepEqual(refusal, { status, retryAfter, body: { error: 'temporarily_unavailable', error_description: words } });
    assert.deepEqual(registry.requests, [organizationId]);
    assert.deepEqual(calls, []);
    assert.match(log.lines[0] ?? '', new RegExp(`"reason":"${reason}"`));
  });
}

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

test('Given 5 searches that run through the gateway, when a sixth search arrives, then it gets the search busy message without a forward, and a search after one ends is forwarded', async (t) => {
  const { forward, upstream, calls, log, tracked } = gatewayOf(t);
  const answers: Array<ReturnType<typeof controlledBody>> = [];
  upstream.answer = async () => {
    const answer = controlledBody();
    answer.send('event: message\ndata: started\n\n');
    answers.push(answer);
    return new Response(answer.body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
  };
  const search = (id: number) => post({ jsonrpc: '2.0', id, method: 'tools/call', params: { name: 'search', arguments: { query: `q${id}`, reason: 'Find it' } } });

  const running = await Promise.all([1, 2, 3, 4, 5].map((id) => forward(search(id))));
  const sixth = await forward(search(6));
  const fetchDuringBusy = await forward(post(fetchCall));
  answers[0]?.end();
  await running[0]?.text();
  await setImmediate();
  const seventh = await forward(search(7));

  assert.deepEqual(await sixth.json(), { jsonrpc: '2.0', id: 6, result: { content: [{ type: 'text', text: 'Server busy. Try again later.' }], isError: true, resultType: 'complete' } });
  assert.equal(fetchDuringBusy.status, 200);
  assert.equal(seventh.status, 200);
  assert.equal(calls.length, 7);
  assert.deepEqual(log.lines, ['INFO MCP gateway refusal: {"organizationId":"org_A","reason":"search-busy"}']);
  for (const answer of answers) answer.end();
  await Promise.all([...running.slice(1), fetchDuringBusy, seventh].map((response) => response.text()));
  await Promise.all(tracked);
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
