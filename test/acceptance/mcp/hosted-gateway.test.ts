import assert from 'node:assert/strict';
import { test } from 'node:test';
import { userGrant } from '../../support/fixtures/hosted-roles.ts';
import { gatewayOrganization, gatewayUser, openHostedGatewaySite } from '../../support/in-process/hosted-gateway-site.ts';
import { fetchCall, sourceUrl, tenantMarkdown } from './fixtures/gateway-calls.ts';

// The MCP gateway of the control plane (SO-05). With MCP_TENANTS_ENABLED on, MCPServer forwards each request that
// passes the bearer check and the access check to the tenant of the organization, with a signed access context. The
// site composes the real control plane with the WorkOS fake, the real registry rules over an in-memory registry, a
// spy of the resume operation, and a fake tenant upstream that verifies the context and serves MCP. This file holds
// the admission and the registry copy; hosted-gateway-states.test.ts holds the row states, and
// hosted-gateway-forward.test.ts the streaming forward.

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

  assert.deepEqual(result.content, [{ type: 'text', text: `Markdown of ${sourceUrl} from the control plane` }]);
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

test('Given a registry copy that cannot be read again, when a call arrives after the 60 s stale bound, then the client gets 503 with Retry-After: 15, and a call before the bound is forwarded', { timeout: 30_000 }, async (t) => {
  const site = await openHostedGatewaySite(t);
  site.registry.live(gatewayOrganization, site.tenant.origin);
  const token = await site.token();
  await site.toolResult({ method: 'tools/call', token, params: fetchCall });
  site.registry.readFailure = true;

  site.advance(30_000);
  const stale = await site.toolResult({ method: 'tools/call', token, params: fetchCall });
  site.advance(31_000);
  const unavailable = await site.refusal({ method: 'tools/call', token, params: fetchCall });

  assert.deepEqual(stale.content, [{ type: 'text', text: tenantMarkdown }]);
  assert.deepEqual(unavailable, { status: 503, retryAfter: '15', error: 'temporarily_unavailable', description: 'The service is temporarily unavailable. Try again in 15 seconds.' });
});
