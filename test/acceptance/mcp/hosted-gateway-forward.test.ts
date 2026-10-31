import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gatewayOrganization, openHostedGatewaySite, otherGatewayOrganization } from '../../support/in-process/hosted-gateway-site.ts';
import { busyWords, fetchCall, restartedWords, searchCall } from './fixtures/gateway-calls.ts';

test('Given a live tenant, when the client sends a Thermus-Access header or hop-by-hop headers, then the tenant gets none of these client values and gets the signed context of the gateway', { timeout: 30_000 }, async (t) => {
  const site = await openHostedGatewaySite(t);
  site.registry.live(gatewayOrganization, site.tenant.origin);
  const clientHeaders = {
    'Thermus-Access': 'client-chosen-context',
    TE: 'trailers',
    Trailer: 'X-Client-Trailer',
    'Keep-Alive': 'timeout=5',
    'Transfer-Encoding': 'chunked',
    Upgrade: 'websocket',
    Connection: 'keep-alive, X-Hop-Header',
    'X-Hop-Header': 'hop-value',
    Cookie: '__Host-thermus-session=private-session',
  };

  const response = await site.handle({ method: 'tools/call', token: await site.token(), params: fetchCall, headers: clientHeaders });

  assert.equal(response.status, 200);
  const [forwarded] = site.tenant.requests;
  assert.ok(forwarded?.context, 'The tenant verified the signed context of the gateway.');
  assert.notEqual(forwarded?.headers['thermus-access'], 'client-chosen-context');
  for (const name of ['te', 'trailer', 'keep-alive', 'transfer-encoding', 'upgrade', 'x-hop-header', 'cookie']) {
    assert.equal(forwarded?.headers[name], undefined, name);
  }
  assert.doesNotMatch(JSON.stringify(forwarded?.headers), /X-Client-Trailer|hop-value|private-session|websocket/);
});

test('Given a tool that sends progress notifications, when the client calls it through the gateway, then each notification reaches the client before the result', { timeout: 30_000 }, async (t) => {
  const site = await openHostedGatewaySite(t);
  site.registry.live(gatewayOrganization, site.tenant.origin);
  const client = await site.connect(await site.token());
  const progress: number[] = [];

  const result = await client.callTool({ name: 'slow', arguments: { label: 'progress' } }, { onprogress: () => { progress.push(performance.now()); } });
  const resultAt = performance.now();

  assert.deepEqual(result.content, [{ type: 'text', text: `slow progress finished for ${gatewayOrganization}` }]);
  assert.equal(progress.length, site.tenant.slowTicks);
  assert.ok(progress.every((time) => time < resultAt));
  const call = site.tenant.slowCalls.get('progress');
  assert.ok(call !== undefined);
  assert.ok((progress[0] ?? Infinity) < (call.finishedAt ?? 0), 'The first notification arrived before the tool finished.');
});

for (const moment of ['before the tenant answers', 'after the tenant answers'] as const) {
  test(`Given a client pinned to protocol 2026-07-28, when it aborts a running call ${moment}, then the tenant sees its signal within 100 ms`, { timeout: 30_000 }, async (t) => {
    const site = await openHostedGatewaySite(t);
    site.registry.live(gatewayOrganization, site.tenant.origin);
    const client = await site.connect(await site.token());
    const held = moment === 'before the tenant answers' ? site.tenant.holdNextAnswer() : undefined;
    const abort = new AbortController();
    const label = moment === 'before the tenant answers' ? 'early' : 'late';

    const call = client.callTool({ name: 'slow', arguments: { label } }, { signal: abort.signal }).catch((error: unknown) => error);
    const heldRequest = held === undefined ? undefined : await held.arrived;
    if (heldRequest === undefined) await site.tenant.untilProgress(label, 2);
    const abortedAt = performance.now();
    abort.abort();
    await call;
    const signalAt = await site.tenant.untilSignal(heldRequest ?? label);

    assert.ok(signalAt - abortedAt <= 100, `The tenant saw its signal ${(signalAt - abortedAt).toFixed(1)} ms after the abort.`);
    held?.release();
  });
}

test('Given a client pinned to protocol 2025-11-25, when it aborts a running call, then the gateway forwards its notifications/cancelled POST to the same tenant with the signed context and returns the 202 of the tenant', { timeout: 30_000 }, async (t) => {
  const site = await openHostedGatewaySite(t);
  site.registry.live(gatewayOrganization, site.tenant.origin);
  const client = await site.connect(await site.token(), '2025-11-25');
  const abort = new AbortController();

  const call = client.callTool({ name: 'slow', arguments: { label: 'legacy' } }, { signal: abort.signal }).catch((error: unknown) => error);
  await site.tenant.untilProgress('legacy', 1);
  abort.abort();
  await call;
  await site.untilWire((exchange) => exchange.rpcMethod === 'notifications/cancelled');

  const cancelled = site.tenant.requests.find((request) => request.rpcMethod === 'notifications/cancelled');
  assert.deepEqual(cancelled?.context?.organizationId, gatewayOrganization);
  assert.equal(cancelled?.answerStatus, 202);
  assert.deepEqual(site.wire.filter((exchange) => exchange.rpcMethod === 'notifications/cancelled').map(({ status }) => status), [202]);
});

test('Given a client pinned to protocol 2025-11-25, when it opens its GET stream, then the gateway passes it to the tenant and the client gets the 405 of the tenant', { timeout: 30_000 }, async (t) => {
  const site = await openHostedGatewaySite(t);
  site.registry.live(gatewayOrganization, site.tenant.origin);
  const client = await site.connect(await site.token(), '2025-11-25');

  const listed = await client.listTools();
  await site.untilWire((exchange) => exchange.httpMethod === 'GET');

  assert.deepEqual(listed.tools.map(({ name }) => name), ['getURLAsMarkdown', 'search', 'slow']);
  const stream = site.tenant.requests.find((request) => request.method === 'GET');
  assert.equal(stream?.context?.organizationId, gatewayOrganization);
  assert.equal(stream?.answerStatus, 405);
  assert.deepEqual(site.wire.filter((exchange) => exchange.httpMethod === 'GET').map(({ status }) => status), [405]);
});

for (const failure of ['http-502', 'reset-before-answer'] as const) {
  test(`Given a tenant live for 3 minutes that fails with ${failure} during a call, when the call fails before the first answer byte, then the client gets one tool error with the restart words and the operator gets a report`, { timeout: 30_000 }, async (t) => {
    const site = await openHostedGatewaySite(t);
    site.registry.live(gatewayOrganization, site.tenant.origin);
    // Past the cold start of a new tenant (hosted-gateway-cold-start.test.ts).
    site.advance(180_000);
    const client = await site.connect(await site.token());
    site.tenant.failNext(failure);
    const before = site.log.lines.length;

    const result = await client.callTool(fetchCall);

    assert.deepEqual([result.isError, result.content], [true, [{ type: 'text', text: restartedWords }]]);
    const lines = site.log.lines.slice(before);
    assert.equal(lines.length, 1, lines.join('\n'));
    assert.match(lines[0] ?? '', new RegExp(`^ERROR MCP gateway tenant restart: .*"organizationId":"${gatewayOrganization}".*"phase":"before-answer"`));
  });
}

test('Given a live tenant that resets the connection after its answer started, when the call fails, then the gateway ends the stream and the operator gets a report', { timeout: 30_000 }, async (t) => {
  const site = await openHostedGatewaySite(t);
  site.registry.live(gatewayOrganization, site.tenant.origin);
  site.tenant.failNext('reset-after-start');
  const before = site.log.lines.length;

  const response = await site.post({ method: 'tools/call', token: await site.token(), params: fetchCall });
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /notifications\/progress/);
  assert.doesNotMatch(body, /"result"/);
  const lines = site.log.lines.slice(before);
  assert.equal(lines.length, 1, lines.join('\n'));
  assert.match(lines[0] ?? '', /^ERROR MCP gateway tenant restart: .*"phase":"during-answer"/);
});

test('Given 5 searches that run through the gateway for two organizations, when a sixth search arrives, then it gets the search busy message, and a search after one ends runs', { timeout: 30_000 }, async (t) => {
  const site = await openHostedGatewaySite(t);
  const other = await site.addTenant(otherGatewayOrganization);
  site.registry.live(gatewayOrganization, site.tenant.origin);
  const holds = [site.tenant.holdSearches(), other.tenant.holdSearches()];
  const [tokenA, tokenB] = [await site.token(), await other.token()];

  const running = [
    ...['a1', 'a2', 'a3'].map((query) => site.post({ method: 'tools/call', token: tokenA, params: searchCall(query) })),
    ...['b1', 'b2'].map((query) => site.post({ method: 'tools/call', token: tokenB, params: searchCall(query) })),
  ];
  await Promise.all([site.tenant.untilSearches(3), other.tenant.untilSearches(2)]);
  const before = site.log.lines.length;
  const sixth = await site.toolResult({ method: 'tools/call', token: tokenB, params: searchCall('b3') });
  const refusalLines = site.log.lines.slice(before);
  for (const hold of holds) hold.release();
  await Promise.all(running.map(async (answer) => (await answer).text()));
  const seventh = await site.toolResult({ method: 'tools/call', token: tokenA, params: searchCall('a4') });

  assert.deepEqual([sixth.isError, sixth.content], [true, [{ type: 'text', text: busyWords }]]);
  assert.equal(other.tenant.requests.filter((request) => request.toolName === 'search').length, 2);
  assert.equal(refusalLines.length, 1, refusalLines.join('\n'));
  assert.match(refusalLines[0] ?? '', /^INFO MCP gateway refusal: .*"reason":"search-busy"/);
  assert.deepEqual(seventh.content, [{ type: 'text', text: `Results for a4 from the tenant of ${gatewayOrganization}` }]);
});
