import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GatewayRoute, GatewayTenantRequest } from '../../../src/interfaces/mcp/mcp-gateway-tenants.ts';
import { fetchCall, gatewayOf, organizationId, post, refusalOf } from './fixtures/gateway-harness.ts';

// The answers of the gateway for each row of the registry and each tenant request (SO-05): the status, the
// Retry-After, the words, the resume, and the one log line of a refusal.

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
