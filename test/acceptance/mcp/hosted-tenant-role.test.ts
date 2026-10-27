import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { RendererProcessDouble } from '../../support/doubles/website-fetcher/renderer-process-double.ts';
import { SigningKey } from '../../support/doubles/workos/jwt-signing-key.ts';
import { mcpRequest, rpcResult } from '../../support/drivers/mcp/mcp-http-request.ts';
import { controlPlaneAuthority, gatewayKeyPairOf, otherOrganizationId, tenantOrganizationId } from '../../support/fixtures/hosted-tenant.ts';
import { openTenantSite, tenantUser } from '../../support/in-process/tenant-site.ts';

// The hosted image in the tenant role (SO-03): THERMUS_ROLE=tenant serves /healthz and /mcp for one organization. The
// test plays the gateway of the control plane: it signs a Thermus-Access context for each request. The tenant checks
// the context and the bearer token, runs the tool, and relays its audit events with the context. The capacity cases
// are in hosted-tenant-capacity.test.ts.

const url = 'https://source.example/story';
const article = '<html><body><main><h1>Tenant story</h1><p>The rendered article has enough words to keep this first paragraph.</p><div hidden>private-hidden-text</div></main></body></html>';
const markdown = 'The rendered article has enough words to keep this first paragraph.';
const fetchCall = { name: 'getURLAsMarkdown', arguments: { url, reason: 'Read the source' } };
const tenantId = `${controlPlaneAuthority}:${tenantOrganizationId}`;

type TenantSite = Awaited<ReturnType<typeof openTenantSite>>;

async function nextTurn(t: TestContext): Promise<void> {
  t.signal.throwIfAborted();
  await new Promise<void>((resolve) => setImmediate(resolve));
}

async function openRenderingSite(t: TestContext, settings: Readonly<Record<string, string>> = {}) {
  const site = await openTenantSite(t, settings);
  const renderer = RendererProcessDouble.install(t);
  renderer.serve(url, { finalUrl: url, html: article });
  return { site, renderer };
}

function toolCallWith(site: TenantSite, token: string, context?: string): Request {
  return mcpRequest({ url: site.mcpUrl.href, method: 'tools/call', token, params: fetchCall, headers: context === undefined ? {} : { 'Thermus-Access': context } });
}

test('Given a tenant of organization A and a valid context and token for A, when the client calls getURLAsMarkdown, then it gets the cleaned Markdown and the relay receives one event with the same context', { timeout: 30_000 }, async (t) => {
  const { site } = await openRenderingSite(t);
  const client = await site.connect(await site.token());

  const result = await client.callTool(fetchCall);
  await site.relay.untilReceived(1);

  assert.deepEqual(result.content, [{ type: 'text', text: markdown }]);
  const [relayed] = site.relay.received;
  assert.deepEqual([relayed?.method, relayed?.path, relayed?.contentType], ['POST', '/internal/audit', 'application/json']);
  assert.equal(relayed?.context, site.gateway.contextOf('tools/call'));
  assert.deepEqual({ eventName: relayed?.event.eventName, organizationId: relayed?.event.organizationId, actor: relayed?.event.actor, tool: relayed?.event.tool, status: relayed?.event.status },
    { eventName: 'mcp.tool.completed', organizationId: tenantId, actor: { authority: controlPlaneAuthority, subject: tenantUser }, tool: 'getURLAsMarkdown', status: 'success' });
  assert.deepEqual(site.completions().map(({ authority, subject, tenantId: tenant, status }) => ({ authority, subject, tenant, status })),
    [{ authority: controlPlaneAuthority, subject: tenantUser, tenant: tenantId, status: 'success' }]);
  assert.equal(site.relay.received.length, 1);
  assert.doesNotMatch(site.lines.join('\n'), /private-hidden-text|Tenant story/);
});

test('Given a context for organization B, an expired context, a bad signature, or a token with another hash, when the request reaches the tenant, then the answer is 403, no tool runs, and the relay receives nothing', { timeout: 30_000 }, async (t) => {
  const { site, renderer } = await openRenderingSite(t);
  const token = await site.token();
  const refused = [
    ['a context for organization B', await site.gateway.contextFor(token, { organizationId: otherOrganizationId })],
    ['an expired context', await site.gateway.contextFor(token, { issuedAtUnixSeconds: Math.floor(Date.now() / 1_000) - 300 })],
    ['a bad signature', await site.gateway.contextFor(token, { key: gatewayKeyPairOf().privateKey })],
    ['a token with another hash', await site.gateway.contextFor(token, { tokenOfHash: await site.token({ sid: 'app_consent_01OTHER' }) })],
  ] as const;

  for (const [label, context] of refused) {
    const response = await fetch(toolCallWith(site, token, context));
    assert.equal(response.status, 403, label);
    assert.equal((await response.json() as { error?: string }).error, 'access_denied', label);
  }

  assert.equal(renderer.launches.length, 0);
  assert.deepEqual(site.completions(), []);
  assert.deepEqual(site.relay.received, []);
});

test('Given a request without the context header, when it reaches the tenant, then the answer is 403 before any MCP handling', { timeout: 30_000 }, async (t) => {
  const { site, renderer } = await openRenderingSite(t);

  const response = await fetch(toolCallWith(site, await site.token()));

  assert.equal(response.status, 403);
  assert.equal((await response.json() as { error?: string }).error, 'access_denied');
  assert.equal(renderer.launches.length, 0);
  assert.deepEqual(site.relay.received, []);
});

test('Given a valid context and a token without a valid AuthKit signature, when the request reaches the tenant, then it gets the bearer refusal of today', { timeout: 30_000 }, async (t) => {
  const { site, renderer } = await openRenderingSite(t);
  const forged = await site.token({}, await SigningKey.generate('authkit-key-1'));

  const response = await fetch(toolCallWith(site, forged, await site.gateway.contextFor(forged)));

  assert.equal(response.status, 401);
  assert.match(response.headers.get('WWW-Authenticate') ?? '', /^Bearer .*error="invalid_token".*resource_metadata="https:\/\/thermus\.example\/\.well-known\/oauth-protected-resource\/mcp"/);
  assert.equal(renderer.launches.length, 0);
  assert.deepEqual(site.relay.received, []);
});

test('Given the tenant role, when a request asks for a path other than /healthz and /mcp, then the answer is 404, and /healthz answers 200 with ok', { timeout: 30_000 }, async (t) => {
  const { site } = await openRenderingSite(t);

  const health = await site.request('/healthz');
  assert.deepEqual([health.status, await health.text()], [200, 'ok\n']);
  for (const path of ['/', '/login', '/session', '/portal/access', '/account', '/signup', '/assets/index.js', '/.well-known/oauth-protected-resource/mcp', '/internal/audit', '/mcp/']) {
    const response = await site.request(path, { headers: { 'Thermus-Access': await site.gateway.contextFor(await site.token()) } });
    assert.equal(response.status, 404, path);
  }
});

test('Given a 2025-era client, when it opens its GET stream at the tenant, then the answer is 405, as today, and the client keeps working', { timeout: 30_000 }, async (t) => {
  const { site } = await openRenderingSite(t);
  const client = await site.connect(await site.token(), '2025-11-25');

  const listed = await client.listTools();
  while (!site.gateway.requests.some((request) => request.httpMethod === 'GET')) await nextTurn(t);

  assert.deepEqual(listed.tools.map(({ name }) => name), ['getURLAsMarkdown', 'search']);
  assert.deepEqual(site.gateway.requests.filter((request) => request.httpMethod === 'GET').map(({ status }) => status), [405]);
});

test('Given a relay target that refuses, when a call ends, then the client still gets its result and the relay stops after three attempts', { timeout: 30_000 }, async (t) => {
  const { site } = await openRenderingSite(t);
  site.relay.answer = 'refuse';
  const client = await site.connect(await site.token());

  const result = await client.callTool(fetchCall);
  await site.relay.untilReceived(3);
  await new Promise<void>((resolve) => setTimeout(resolve, 3_000));

  assert.deepEqual(result.content, [{ type: 'text', text: markdown }]);
  assert.equal(site.relay.received.length, 3);
  assert.equal(new Set(site.relay.received.map(({ event }) => event.operationId)).size, 1);
});

test('Given a relay target that does not answer, when calls end, then each client gets its result and the tenant holds one relay request open', { timeout: 30_000 }, async (t) => {
  const { site } = await openRenderingSite(t);
  site.relay.answer = 'hang';
  const client = await site.connect(await site.token());

  const first = await client.callTool(fetchCall);
  await site.relay.untilReceived(1);
  const second = await client.callTool(fetchCall);

  assert.deepEqual([first.content, second.content], [[{ type: 'text', text: markdown }], [{ type: 'text', text: markdown }]]);
  assert.deepEqual([site.relay.received.length, site.relay.open], [1, 1]);
  assert.deepEqual(site.completions().map(({ status }) => status), ['success', 'success']);
});

test('Given a call that ran, when the relay sends its event, then the event holds the final public result and neither the bearer token nor the context', { timeout: 30_000 }, async (t) => {
  const { site } = await openRenderingSite(t);
  const token = await site.token();

  const result = await rpcResult(await fetch(toolCallWith(site, token, await site.gateway.contextFor(token))));
  await site.relay.untilReceived(1);

  assert.deepEqual(result.content, [{ type: 'text', text: markdown }]);
  const [relayed] = site.relay.received;
  assert.equal((relayed?.event.result as { text?: string } | undefined)?.text, markdown);
  assert.ok(!JSON.stringify(relayed?.event).includes(token));
  assert.ok(!JSON.stringify(relayed?.event).includes(String(relayed?.context)));
});
