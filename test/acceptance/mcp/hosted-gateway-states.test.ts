import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { gatewayOrganization, openHostedGatewaySite } from '../../support/in-process/hosted-gateway-site.ts';
import { fetchCall } from './fixtures/gateway-calls.ts';

for (const state of ['requested', 'creating', 'deploying'] as const) {
  test(`Given a tenant in state ${state}, when a call arrives, then the client gets 503 with Retry-After: 15 and a safe message`, { timeout: 30_000 }, async (t) => {
    const site = await openHostedGatewaySite(t);
    site.registry.set(gatewayOrganization, { state });

    const refusal = await site.refusal({ method: 'tools/call', token: await site.token(), params: fetchCall });

    assert.deepEqual(refusal, { status: 503, retryAfter: '15', error: 'temporarily_unavailable', description: 'Your workspace is not ready yet. Try again in 15 seconds.' });
    assert.deepEqual(site.tenant.requests, []);
  });
}

test('Given a suspended tenant, when a call arrives, then the client gets 503 with Retry-After: 60, the row is deploying, and the resume operation gets one call', { timeout: 30_000 }, async (t) => {
  const site = await openHostedGatewaySite(t);
  site.registry.set(gatewayOrganization, { state: 'suspended', serviceId: 'srv-gatewaya' });

  const refusal = await site.refusal({ method: 'tools/call', token: await site.token(), params: fetchCall });

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

  const answers = [site.refusal({ method: 'tools/call', token, params: fetchCall }), site.refusal({ method: 'tools/call', token, params: fetchCall })];
  await site.resume.untilCalls(1);
  await delay(50);
  resuming.release();
  const refusals = await Promise.all(answers);
  const later = await site.refusal({ method: 'tools/call', token, params: fetchCall });

  assert.deepEqual(refusals.map(({ status, retryAfter }) => [status, retryAfter]), [[503, '60'], [503, '60']]);
  assert.deepEqual([later.status, later.retryAfter], [503, '60']);
  assert.equal(site.resume.calls.length, 1);
});

test('Given a tenant in state failed, when calls arrive, then each client gets 503 and the operator gets one report', { timeout: 30_000 }, async (t) => {
  const site = await openHostedGatewaySite(t);
  site.registry.set(gatewayOrganization, { state: 'failed' });
  const token = await site.token();

  const first = await site.refusal({ method: 'tools/call', token, params: fetchCall });
  const second = await site.refusal({ method: 'tools/call', token, params: fetchCall });

  for (const refusal of [first, second]) {
    assert.deepEqual(refusal, { status: 503, retryAfter: null, error: 'temporarily_unavailable', description: 'Workspace setup failed. We have been notified and will fix it.' });
  }
  assert.equal(site.log.lines.filter((line) => line.startsWith('ERROR ')).length, 1, site.log.lines.join('\n'));
  assert.match(site.log.lines.find((line) => line.startsWith('ERROR ')) ?? '', new RegExp(`MCP gateway refusal: .*"organizationId":"${gatewayOrganization}".*"reason":"failed"`));
});

test('Given an organization with product access and no row, when a call arrives, then the gateway requests the tenant and answers 503; at a full cap, the answer is 503 with the capacity message', { timeout: 30_000 }, async (t) => {
  const site = await openHostedGatewaySite(t);
  const requested = await site.refusal({ method: 'tools/call', token: await site.token(), params: fetchCall });
  assert.deepEqual(requested, { status: 503, retryAfter: '15', error: 'temporarily_unavailable', description: 'Your workspace is not ready yet. Try again in 15 seconds.' });
  assert.deepEqual(site.registry.inserts, [gatewayOrganization]);
  assert.equal(site.registry.stateOf(gatewayOrganization), 'requested');

  const full = await openHostedGatewaySite(t, { freeTenantLimit: 0 });
  const refused = await full.refusal({ method: 'tools/call', token: await full.token(), params: fetchCall });
  assert.deepEqual(refused, { status: 503, retryAfter: null, error: 'temporarily_unavailable', description: 'All free workspaces are in use. Try again later.' });
  assert.deepEqual(full.registry.inserts, []);
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
  const lines = site.log.lines.slice(before);
  assert.equal(lines.length, 1, lines.join('\n'));
  assert.match(lines[0] ?? '', new RegExp(`^INFO MCP gateway refusal: .*"organizationId":"${gatewayOrganization}".*"reason":"starting".*"state":"creating"`));
  assert.deepEqual(site.sender.attempts, []);
  assert.equal(site.settings.reads.length, reads);
});
