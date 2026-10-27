import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import { test, type TestContext } from 'node:test';
import { createLocalJWKSet } from 'jose';
import { createHostedToolOperations } from '../../../src/app/fetch-tool.ts';
import { composeTenantApplication } from '../../../src/app/tenant-application.ts';
import { loadDeploymentConfig } from '../../../src/runtime/config/deployment-config.ts';
import { ObserveRequestStep } from '../../../src/pipelines/execution/observe-request-step.ts';
import { AuditRelayRouteSpy } from '../../support/doubles/logging/audit-relay-route-spy.ts';
import { RendererProcessDouble } from '../../support/doubles/website-fetcher/renderer-process-double.ts';
import { SigningKey } from '../../support/doubles/workos/jwt-signing-key.ts';
import { mcpRequest, rpcResult } from '../../support/drivers/mcp/mcp-http-request.ts';
import { SignedContextGateway } from '../../support/drivers/mcp/signed-context-gateway.ts';
import { trustedAdRulesFile } from '../../support/fixtures/ad-rules.ts';
import { workOSSettings } from '../../support/fixtures/hosted-placeholder.ts';
import { controlPlaneAuthority, gatewayKeyPairOf, tenantOrganizationId, tenantSettingsOf } from '../../support/fixtures/hosted-tenant.ts';
import { repositoryRoot } from '../../support/processes/module-paths.ts';

// The tenant composition of app with the real mcp, identity, audit-logs, and config packages and the production tool
// operations. The renderer double stands in for Lightpanda, and a local key set for AuthKit.

const logger = { info: (_line: string) => {}, error: (_line: string) => {} };
const fetchUrl = 'https://page.test/';
const searchHtml = readFileSync(new URL('test/support/fixtures/search-engine/brave-results.html', repositoryRoot), 'utf8');

async function composeTenant(t: TestContext, settings: Readonly<Record<string, string>> = {}) {
  const relay = await AuditRelayRouteSpy.start(t);
  const keys = gatewayKeyPairOf();
  const authkitKey = await SigningKey.generate('authkit-key-1');
  const environment = { AD_RULES_FILE: trustedAdRulesFile, LIGHTPANDA_BIN: '/opt/thermus-test/lightpanda', ...tenantSettingsOf(keys.publicKeyPem, relay.origin), ...settings };
  const config = loadDeploymentConfig(environment, 'http');
  assert.ok(config.deployment === 'hosted' && config.role === 'tenant');
  const application = composeTenantApplication(config, { logger, operations: createHostedToolOperations(environment, logger), authkitKeySet: createLocalJWKSet({ keys: [authkitKey.publicJwk] }) });
  t.after(() => application.close());
  const gateway = new SignedContextGateway(keys.privateKey, { authority: controlPlaneAuthority, subject: 'user_01TENANT', organizationId: tenantOrganizationId, grants: [{ role: 'user', permissions: ['product:access'] }] });
  const token = await authkitKey.sign({ sub: 'user_01TENANT', client_id: 'client_01MCP', sid: 'app_consent_01', scope: 'openid', org_id: tenantOrganizationId }, { issuer: workOSSettings.WORKOS_AUTHKIT_ISSUER, audience: config.mcpResourceUrl });
  const call = async (params: Readonly<Record<string, unknown>>): Promise<Request> => mcpRequest({ url: config.mcpResourceUrl, method: 'tools/call', token, params, headers: { 'Thermus-Access': await gateway.contextFor(token) } });
  return { application, relay, call, url: (path: string) => new URL(path, config.publicBaseUrl) };
}

test('Given the tenant composition, when requests reach it, then it serves /healthz and /mcp only: health answers GET and HEAD and refuses other methods, an MCP request without a context gets 403, and each other path gets 404', { timeout: 10_000 }, async (t) => {
  const { application, url } = await composeTenant(t);

  const health = await application.handle(new Request(url('healthz')));
  const head = await application.handle(new Request(url('healthz'), { method: 'HEAD' }));
  const post = await application.handle(new Request(url('healthz'), { method: 'POST' }));
  const mcp = await application.handle(mcpRequest({ url: url('mcp').href, method: 'tools/list' }));

  assert.deepEqual([health.status, health.headers.get('Content-Type'), health.headers.get('Cache-Control'), await health.text()], [200, 'text/plain; charset=utf-8', 'no-store', 'ok\n']);
  assert.deepEqual([head.status, await head.text()], [200, '']);
  assert.deepEqual([post.status, post.headers.get('Allow')], [405, 'GET, HEAD']);
  assert.equal(mcp.status, 403);
  for (const path of ['', 'login', 'session', 'billing', 'internal/audit', '.well-known/oauth-protected-resource/mcp', 'assets/index.js']) {
    assert.equal((await application.handle(new Request(url(path)))).status, 404, path);
  }
});

test('Given OPERATION_CAPACITY=2, when the tenant holds a fetch and a search and a third call with a valid context arrives, then the third call is busy, both held calls complete, and the relay gets each event with the context of its call', { timeout: 10_000 }, async (t) => {
  const renderer = RendererProcessDouble.install(t);
  const searchUrl = 'https://search.brave.com/search?q=query';
  renderer.serve(fetchUrl, { finalUrl: fetchUrl, html: '<html><body><h1>Page title</h1><p>Page content.</p></body></html>' });
  renderer.serve(searchUrl, { finalUrl: searchUrl, html: searchHtml });
  const held: PromiseWithResolvers<void>[] = [];
  const observe = ObserveRequestStep.prototype.execute;
  t.mock.method(ObserveRequestStep.prototype, 'execute', async function (this: ObserveRequestStep, ...args: Parameters<typeof observe>) {
    const gate = Promise.withResolvers<void>();
    held.push(gate);
    await gate.promise;
    return observe.apply(this, args);
  });
  t.after(() => { for (const gate of held) gate.resolve(); });
  const { application, relay, call } = await composeTenant(t, { OPERATION_CAPACITY: '2' });

  const fetchRequest = await call({ name: 'getURLAsMarkdown', arguments: { url: fetchUrl, reason: 'Read the page' } });
  const fetch = application.handle(fetchRequest);
  const search = application.handle(await call({ name: 'search', arguments: { query: 'query', reason: 'Find the page' } }));
  while (held.length < 2) await setImmediate();
  const busy = await rpcResult(await application.handle(await call({ name: 'getURLAsMarkdown', arguments: { url: fetchUrl, reason: 'Read the page' } })));
  for (const gate of held) gate.resolve();
  const fetched = await rpcResult(await fetch);
  await search;
  await relay.untilReceived(3);

  assert.deepEqual(busy.content, [{ type: 'text', text: 'Server busy. Try again later.' }]);
  assert.match(JSON.stringify(fetched.content), /Page content/);
  assert.deepEqual(relay.received.map(({ event }) => event.status).toSorted(), ['busy', 'success', 'success']);
  assert.ok(relay.received.some(({ context }) => context === fetchRequest.headers.get('Thermus-Access')));
  assert.deepEqual(new Set(relay.received.map(({ path }) => path)), new Set(['/internal/audit']));
});
