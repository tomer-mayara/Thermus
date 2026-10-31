import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gatewayOrganization, openHostedGatewaySite } from '../../support/in-process/hosted-gateway-site.ts';
import { freeLoopbackPort } from '../../support/isolation/free-port.ts';
import { fetchCall, restartedWords, startingWords } from './fixtures/gateway-calls.ts';

// The SO-12 release rehearsal of 31 October 2026 (release record section 3.7, item 5): a new tenant refused calls for
// about 75 s after the provisioner recorded its row live, as SO-03 measured for the private address of a new service
// (refused 16.5 s after live, answered 76.4 s after it). The Axiom monitor Tenant restart of runbook 7.3 emails the
// owner for each line that contains its match, so the gateway tells this cold start apart from a restart.
const restartMonitorMatch = 'MCP gateway tenant restart: ';

function tenantLines(lines: readonly string[]): string[] {
  return lines.filter((line) => line.includes('MCP gateway tenant '));
}

test('Given a tenant whose row went live 30 s ago and whose private address still refuses connections, when a client calls a tool, then the client gets the starting words, and the system log has one INFO starting line and no line for the Tenant restart monitor', { timeout: 30_000 }, async (t) => {
  const site = await openHostedGatewaySite(t);
  site.registry.live(gatewayOrganization, `http://127.0.0.1:${await freeLoopbackPort()}`);
  const token = await site.token();
  site.advance(30_000);

  const result = await site.toolResult({ method: 'tools/call', token, params: fetchCall });

  assert.deepEqual([result.isError, result.content], [true, [{ type: 'text', text: startingWords }]]);
  assert.deepEqual(tenantLines(site.log.lines), [`INFO MCP gateway tenant starting: {"organizationId":"${gatewayOrganization}","cause":"connection","secondsSinceLive":30}`]);
  assert.deepEqual(site.log.lines.filter((line) => line.startsWith('ERROR ') || line.includes(restartMonitorMatch)), []);
});

test('Given a tenant that has been live for 3 minutes and restarts, so that its private address refuses connections, when a client calls a tool, then the client gets the restart words, and the operator gets one ERROR restart line for the Tenant restart monitor', { timeout: 30_000 }, async (t) => {
  const site = await openHostedGatewaySite(t);
  site.registry.live(gatewayOrganization, `http://127.0.0.1:${await freeLoopbackPort()}`);
  const token = await site.token();
  site.advance(180_000);

  const result = await site.toolResult({ method: 'tools/call', token, params: fetchCall });

  assert.deepEqual([result.isError, result.content], [true, [{ type: 'text', text: restartedWords }]]);
  assert.deepEqual(tenantLines(site.log.lines), [`ERROR MCP gateway tenant restart: {"organizationId":"${gatewayOrganization}","phase":"before-answer","cause":"connection"}`]);
  assert.ok(site.log.lines.some((line) => line.includes(restartMonitorMatch)));
});

test('Given a tenant whose private address still refuses connections 2 minutes after its row went live, when a client calls a tool, then the cold start is over: the client gets the restart words, and the operator gets one ERROR restart line', { timeout: 30_000 }, async (t) => {
  const site = await openHostedGatewaySite(t);
  site.registry.live(gatewayOrganization, `http://127.0.0.1:${await freeLoopbackPort()}`);
  const token = await site.token();
  site.advance(30_000);
  const duringColdStart = await site.toolResult({ method: 'tools/call', token, params: fetchCall });
  site.advance(90_000);

  const afterColdStart = await site.toolResult({ method: 'tools/call', token, params: fetchCall });

  assert.deepEqual([duringColdStart.content, afterColdStart.content], [[{ type: 'text', text: startingWords }], [{ type: 'text', text: restartedWords }]]);
  assert.deepEqual(tenantLines(site.log.lines).map((line) => line.replace(/: \{.*$/, '')), ['INFO MCP gateway tenant starting', 'ERROR MCP gateway tenant restart']);
});
