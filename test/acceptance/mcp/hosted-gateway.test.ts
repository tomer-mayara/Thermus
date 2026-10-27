import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { userGrant } from '../../support/fixtures/hosted-roles.ts';
import { gatewayOrganization, gatewayUser, openHostedGatewaySite, otherGatewayOrganization, type HostedGatewaySite } from '../../support/in-process/hosted-gateway-site.ts';

// The MCP gateway of the control plane (SO-05). With MCP_TENANTS_ENABLED on, MCPServer forwards each request that
// passes the bearer check and the access check to the tenant of the organization, with a signed access context. The
// site composes the real control plane with the WorkOS fake, the real registry rules over an in-memory registry, a
// spy of the resume operation, and a fake tenant upstream that verifies the context and serves MCP.

const url = 'https://source.example/story';
const fetchCall = { name: 'getURLAsMarkdown', arguments: { url, reason: 'Read the source' } };
const tenantMarkdown = `Markdown of ${url} from the tenant of ${gatewayOrganization}`;
const restarted = 'Server restarted. Try again in a minute.';
const busy = 'Server busy. Try again later.';

function searchCall(query: string) {
  return { name: 'search', arguments: { query, reason: 'Find the source' } };
}

async function refusalOf(response: Response): Promise<{ status: number; retryAfter: string | null; error: unknown; description: unknown }> {
  const body = await response.json() as { error?: unknown; error_description?: unknown };
  return { status: response.status, retryAfter: response.headers.get('Retry-After'), error: body.error, description: body.error_description };
}

function linesAfter(site: HostedGatewaySite, before: number): string[] {
  return site.log.lines.slice(before);
}

test('Given the switch on and a live tenant for organization A, when a client of A calls a tool, then the tenant answers through the gateway, the control plane exports the audit event, and the audience and the metadata URLs stay public', { timeout: 30_000 }, async (t) => {
  const site = await openHostedGatewaySite(t);
  site.registry.live(gatewayOrganization, site.tenant.origin);
  await site.enableExport();
  const token = await site.token();
  const client = await site.connect(token);

  const result = await client.callTool(fetchCall);
  await site.sender.untilAttempts(1);

  assert.deepEqual(result.content, [{ type: 'text', text: tenantMarkdown }]);
  const call = site.tenant.requests.find((request) => request.rpcMethod === 'tools/call');
  assert.equal(call?.bearerToken, token);
  // The WorkOS fake gives each user the last name Example, so the display name of the access is "Gateway Example".
  assert.deepEqual(call?.context, { authority: site.authority, subject: gatewayUser.id, name: `${gatewayUser.firstName} Example`, organizationId: gatewayOrganization, grants: [userGrant] });
  assert.equal(site.sender.attempts.length, 1);
  const [exported] = site.sender.attempts;
  assert.equal(exported?.event.eventName, 'mcp.tool.completed');
  assert.equal(exported?.event.organizationId, site.tenantId());
  assert.deepEqual(exported?.event.eventName === 'mcp.tool.completed' ? [exported.event.tool, exported.event.status, exported.event.result.text] : [], ['getURLAsMarkdown', 'success', tenantMarkdown]);
  const metadata = await site.request('/.well-known/oauth-protected-resource/mcp');
  assert.equal((await metadata.json() as { resource?: string }).resource, 'https://thermus.example/mcp');
  const challenge = await site.post({ method: 'tools/call', params: fetchCall });
  assert.equal(challenge.status, 401);
  assert.match(challenge.headers.get('WWW-Authenticate') ?? '', /resource_metadata="https:\/\/thermus\.example\/\.well-known\/oauth-protected-resource\/mcp"/);
});

test('Given the switch off, when a client calls a tool, then the control plane runs the tool as today, reads no registry, and forwards nothing', { timeout: 30_000 }, async (t) => {
  const site = await openHostedGatewaySite(t, { tenantsEnabled: false });
  site.registry.live(gatewayOrganization, site.tenant.origin);
  const client = await site.connect(await site.token());

  const result = await client.callTool(fetchCall);
  const relay = await site.relay(await site.relayEventOf(), await site.contextFor());

  assert.deepEqual(result.content, [{ type: 'text', text: `Markdown of ${url} from the control plane` }]);
  assert.deepEqual(site.tenant.requests, []);
  assert.equal(site.registry.reads, 0);
  assert.equal(relay.status, 401, 'Without the switch, /internal/audit stays an account path that needs a sign-in.');
});

test('Given a token without org_id, an inactive membership, or no product:access, when the request arrives, then it gets the denial of today, the gateway forwards nothing, and no tenant is requested', { timeout: 30_000 }, async (t) => {
  const site = await openHostedGatewaySite(t);
  const denied = [
    ['a token without org_id', await site.token({ org_id: undefined })],
  ] as Array<readonly [string, string]>;
  for (const [label, token] of denied) {
    const response = await site.post({ method: 'tools/call', token, params: fetchCall });
    assert.equal(response.status, 403, label);
    assert.equal((await response.json() as { error?: string }).error, 'access_denied', label);
  }
  for (const [label, membership] of [
    ['an inactive membership', { userId: gatewayUser.id, organizationId: gatewayOrganization, roles: ['user'], status: 'inactive' as const }],
    ['a membership without product:access', { userId: gatewayUser.id, organizationId: gatewayOrganization, roles: ['member'] }],
  ] as const) {
    site.world.memberships = [membership];
    const response = await site.post({ method: 'tools/call', token: await site.token(), params: fetchCall });
    assert.equal(response.status, 403, label);
    assert.equal((await response.json() as { error?: string }).error, 'access_denied', label);
  }

  assert.deepEqual(site.tenant.requests, []);
  assert.deepEqual(site.registry.inserts, []);
  assert.equal(site.registry.reads, 0);
});

for (const state of ['requested', 'creating', 'deploying'] as const) {
  test(`Given a tenant in state ${state}, when a call arrives, then the client gets 503 with Retry-After: 15 and a safe message`, { timeout: 30_000 }, async (t) => {
    const site = await openHostedGatewaySite(t);
    site.registry.set(gatewayOrganization, { state });

    const refusal = await refusalOf(await site.post({ method: 'tools/call', token: await site.token(), params: fetchCall }));

    assert.deepEqual(refusal, { status: 503, retryAfter: '15', error: 'temporarily_unavailable', description: 'Your workspace is not ready yet. Try again in 15 seconds.' });
    assert.deepEqual(site.tenant.requests, []);
  });
}

test('Given a suspended tenant, when a call arrives, then the client gets 503 with Retry-After: 60, the row is deploying, and the resume operation gets one call', { timeout: 30_000 }, async (t) => {
  const site = await openHostedGatewaySite(t);
  site.registry.set(gatewayOrganization, { state: 'suspended', serviceId: 'srv-gatewaya' });

  const refusal = await refusalOf(await site.post({ method: 'tools/call', token: await site.token(), params: fetchCall }));

  assert.deepEqual(refusal, { status: 503, retryAfter: '60', error: 'temporarily_unavailable', description: 'Your workspace is restarting after a pause. Try again in a minute.' });
  assert.equal(site.registry.stateOf(gatewayOrganization), 'deploying');
  assert.deepEqual(site.resume.calls, [{ organizationId: gatewayOrganization, serviceId: 'srv-gatewaya' }]);
  assert.deepEqual(site.tenant.requests, []);
});

test('Given a suspended tenant, when two calls arrive at the same time, then the resume operation gets one call and both clients get 503 with Retry-After: 60', { timeout: 30_000 }, async (t) => {
  const site = await openHostedGatewaySite(t);
  site.registry.set(gatewayOrganization, { state: 'suspended', serviceId: 'srv-gatewaya' });
  const resuming = site.resume.hold();
  const token = await site.token();

  const answers = [site.post({ method: 'tools/call', token, params: fetchCall }), site.post({ method: 'tools/call', token, params: fetchCall })];
  await site.resume.untilCalls(1);
  await delay(50);
  resuming.release();
  const refusals = await Promise.all(answers.map(async (answer) => refusalOf(await answer)));
  const later = await refusalOf(await site.post({ method: 'tools/call', token, params: fetchCall }));

  assert.deepEqual(refusals.map(({ status, retryAfter }) => [status, retryAfter]), [[503, '60'], [503, '60']]);
  assert.deepEqual([later.status, later.retryAfter], [503, '60']);
  assert.equal(site.resume.calls.length, 1);
});

test('Given a tenant in state failed, when calls arrive, then each client gets 503 and the operator gets one report', { timeout: 30_000 }, async (t) => {
  const site = await openHostedGatewaySite(t);
  site.registry.set(gatewayOrganization, { state: 'failed' });
  const token = await site.token();

  const first = await refusalOf(await site.post({ method: 'tools/call', token, params: fetchCall }));
  const second = await refusalOf(await site.post({ method: 'tools/call', token, params: fetchCall }));

  for (const refusal of [first, second]) {
    assert.deepEqual(refusal, { status: 503, retryAfter: null, error: 'temporarily_unavailable', description: 'Workspace setup failed. We have been notified and will fix it.' });
  }
  assert.equal(site.log.lines.filter((line) => line.startsWith('ERROR ')).length, 1, site.log.lines.join('\n'));
  assert.match(site.log.lines.find((line) => line.startsWith('ERROR ')) ?? '', new RegExp(`MCP gateway refusal: .*"organizationId":"${gatewayOrganization}".*"reason":"failed"`));
});

test('Given an organization with product access and no row, when a call arrives, then the gateway requests the tenant and answers 503; at a full cap, the answer is 503 with the capacity message', { timeout: 30_000 }, async (t) => {
  const site = await openHostedGatewaySite(t);
  const requested = await refusalOf(await site.post({ method: 'tools/call', token: await site.token(), params: fetchCall }));
  assert.deepEqual(requested, { status: 503, retryAfter: '15', error: 'temporarily_unavailable', description: 'Your workspace is not ready yet. Try again in 15 seconds.' });
  assert.deepEqual(site.registry.inserts, [gatewayOrganization]);
  assert.equal(site.registry.stateOf(gatewayOrganization), 'requested');

  const full = await openHostedGatewaySite(t, { freeTenantLimit: 0 });
  const refused = await refusalOf(await full.post({ method: 'tools/call', token: await full.token(), params: fetchCall }));
  assert.deepEqual(refused, { status: 503, retryAfter: null, error: 'temporarily_unavailable', description: 'All free workspaces are in use. Try again later.' });
  assert.deepEqual(full.registry.inserts, []);
});

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
  // Each notification reached the client while the tool still ran: the gateway streams and does not buffer.
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
  test(`Given a live tenant that fails with ${failure} during a call, when the call fails before the first answer byte, then the client gets one tool error with the restart words and the operator gets a report`, { timeout: 30_000 }, async (t) => {
    const site = await openHostedGatewaySite(t);
    site.registry.live(gatewayOrganization, site.tenant.origin);
    const client = await site.connect(await site.token());
    site.tenant.failNext(failure);
    const before = site.log.lines.length;

    const result = await client.callTool(fetchCall);

    assert.deepEqual([result.isError, result.content], [true, [{ type: 'text', text: restarted }]]);
    const lines = linesAfter(site, before);
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
  const lines = linesAfter(site, before);
  assert.equal(lines.length, 1, lines.join('\n'));
  assert.match(lines[0] ?? '', /^ERROR MCP gateway tenant restart: .*"phase":"during-answer"/);
});

test('Given repeated calls of a live tenant within one minute, when they end, then last_active_at changes at most one time in that minute', { timeout: 30_000 }, async (t) => {
  const site = await openHostedGatewaySite(t);
  site.registry.live(gatewayOrganization, site.tenant.origin);
  const client = await site.connect(await site.token());

  for (let call = 0; call < 3; call += 1) await client.callTool(fetchCall);
  site.advance(30_000);
  await client.callTool(fetchCall);
  const withinMinute = site.registry.activeWrites.length;
  site.advance(30_000);
  await client.callTool(fetchCall);

  assert.deepEqual(withinMinute, 1);
  assert.deepEqual(site.registry.activeWrites, [gatewayOrganization, gatewayOrganization]);
});

test('Given a gateway refusal, when it happens, then the system log has one line and no audit event is written', { timeout: 30_000 }, async (t) => {
  const site = await openHostedGatewaySite(t);
  await site.enableExport();
  site.registry.set(gatewayOrganization, { state: 'creating' });
  const before = site.log.lines.length;
  const reads = site.settings.reads.length;

  const response = await site.post({ method: 'tools/call', token: await site.token(), params: fetchCall });
  await delay(50);

  assert.equal(response.status, 503);
  const lines = linesAfter(site, before);
  assert.equal(lines.length, 1, lines.join('\n'));
  assert.match(lines[0] ?? '', new RegExp(`^INFO MCP gateway refusal: .*"organizationId":"${gatewayOrganization}".*"reason":"starting".*"state":"creating"`));
  assert.deepEqual(site.sender.attempts, []);
  assert.equal(site.settings.reads.length, reads);
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
  const refusalLines = linesAfter(site, before);
  for (const hold of holds) hold.release();
  await Promise.all(running.map(async (answer) => (await answer).text()));
  const seventh = await site.toolResult({ method: 'tools/call', token: tokenA, params: searchCall('a4') });

  assert.deepEqual([sixth.isError, sixth.content], [true, [{ type: 'text', text: busy }]]);
  assert.equal(other.tenant.requests.filter((request) => request.toolName === 'search').length, 2);
  assert.equal(refusalLines.length, 1, refusalLines.join('\n'));
  assert.match(refusalLines[0] ?? '', /^INFO MCP gateway refusal: .*"reason":"search-busy"/);
  assert.deepEqual(seventh.content, [{ type: 'text', text: `Results for a4 from the tenant of ${gatewayOrganization}` }]);
});

test('Given a registry copy that cannot be read again, when a call arrives after the 60 s stale bound, then the client gets 503 with Retry-After: 15, and a call before the bound is forwarded', { timeout: 30_000 }, async (t) => {
  const site = await openHostedGatewaySite(t);
  site.registry.live(gatewayOrganization, site.tenant.origin);
  const token = await site.token();
  await site.toolResult({ method: 'tools/call', token, params: fetchCall });
  site.registry.readFailure = true;

  site.advance(30_000);
  const stale = await site.toolResult({ method: 'tools/call', token, params: fetchCall });
  site.advance(31_000);
  const unavailable = await refusalOf(await site.post({ method: 'tools/call', token, params: fetchCall }));

  assert.deepEqual(stale.content, [{ type: 'text', text: tenantMarkdown }]);
  assert.deepEqual(unavailable, { status: 503, retryAfter: '15', error: 'temporarily_unavailable', description: 'The service is temporarily unavailable. Try again in 15 seconds.' });
});
