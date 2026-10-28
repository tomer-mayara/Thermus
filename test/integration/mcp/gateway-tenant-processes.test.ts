import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { WorkOSFake, type FakeUser } from '../../support/doubles/workos/workos-fake.ts';
import { connectMcpClient } from '../../support/drivers/mcp/mcp-sdk-client.ts';
import { completionRecordsIn } from '../../support/drivers/operator-log.ts';
import { controlPlaneTenantSettingsOf } from '../../support/fixtures/control-plane-tenants.ts';
import { hostedFetchSettings, workOSSettings } from '../../support/fixtures/hosted-placeholder.ts';
import { gatewayKeyPairOf, tenantOrganizationId, tenantSettingsOf } from '../../support/fixtures/hosted-tenant.ts';
import { freeLoopbackPort } from '../../support/isolation/free-port.ts';
import { oneLiveTenant, workosFakeRoute } from '../../support/processes/module-paths.ts';
import { withPreload } from '../../support/processes/server-preloads.ts';
import { ServerProcess, type ServerSettings } from '../../support/processes/server-process.ts';

// Both roles of the hosted image as two local processes (SO-05): the control plane with MCP_TENANTS_ENABLED on and the
// tenant of one organization. They reach each other on loopback only; WorkOS is a local fake, and a preload gives the
// control plane one live registry row and an idle provisioner without PostgreSQL. The renderer is the stub of the offline tests, so the tool
// call ends as a fetch failure of the tenant, which is enough to show the forward and the relay.

const user: FakeUser = { id: 'user_01PROCESSES', email: 'processes@example.com', firstName: 'Process' };
const authority = `workos:${workOSSettings.WORKOS_CLIENT_ID}`;
const tenantId = `${authority}:${tenantOrganizationId}`;
const publicBaseUrl = 'https://thermus.example';

async function until(t: { readonly signal: AbortSignal }, ready: () => boolean): Promise<void> {
  while (!ready()) await delay(20, undefined, { signal: t.signal });
}

test('Given the control plane and the tenant of organization A as two processes, when a client of A calls a tool through the control plane, then the tenant process answers and its audit relay reaches the control plane', { timeout: 60_000 }, async (t) => {
  const world = await WorkOSFake.start(t, `${publicBaseUrl}/`, [tenantOrganizationId]);
  world.users = [user];
  world.memberships = [{ userId: user.id, organizationId: tenantOrganizationId, roles: ['user'] }];
  const keys = gatewayKeyPairOf();
  const controlPlanePort = await freeLoopbackPort();
  const internalUrl = `http://127.0.0.1:${controlPlanePort}`;
  const routeToFake = { THERMUS_TEST_WORKOS_ORIGIN: world.fake.origin };
  const tenantSettings: ServerSettings = { ...hostedFetchSettings, ...tenantSettingsOf(keys.publicKeyPem, internalUrl), ...routeToFake, LISTEN_HOST: '127.0.0.1', LISTEN_PORT: '0' };
  const tenant = await ServerProcess.start(t, withPreload(tenantSettings, workosFakeRoute), { network: 'loopback' });
  const controlPlaneSettings: ServerSettings = {
    ...hostedFetchSettings, ...workOSSettings, ...routeToFake,
    DEPLOYMENT: 'hosted', PUBLIC_BASE_URL: publicBaseUrl, LISTEN_HOST: '127.0.0.1', LISTEN_PORT: String(controlPlanePort),
    ...controlPlaneTenantSettingsOf(keys, internalUrl),
    DATABASE_URL: 'postgresql://thermus_logging:placeholder-password@127.0.0.1:9/postgres', LOGGING_DESTINATION_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('base64'),
    THERMUS_TEST_TENANT_ORGANIZATION: tenantOrganizationId, THERMUS_TEST_TENANT_URL: (await tenant.started()).origin,
  };
  const controlPlane = await ServerProcess.start(t, withPreload(withPreload(controlPlaneSettings, workosFakeRoute), oneLiveTenant), { network: 'loopback' });
  const token = await world.authkitKey.sign(
    { sub: user.id, client_id: 'client_01PROCESSES', sid: 'app_consent_processes', scope: 'openid', org_id: tenantOrganizationId },
    { issuer: workOSSettings.WORKOS_AUTHKIT_ISSUER, audience: `${publicBaseUrl}/mcp` },
  );
  const transport = new StreamableHTTPClientTransport(new URL('mcp', await controlPlane.started()), { authProvider: { token: async () => token } });
  const client = await connectMcpClient(t, transport);
  t.after(() => client.close());

  const result = await client.callTool({ name: 'getURLAsMarkdown', arguments: { url: 'https://93.184.216.34/page', reason: 'Show the path through the gateway' } });
  await until(t, () => completionRecordsIn(tenant.output).length > 0 && /Relayed audit event captured/.test(controlPlane.output));

  assert.equal(result.isError, true, JSON.stringify(result.content));
  assert.match((result.content as Array<{ text?: string }>)[0]?.text ?? '', /^Page fetch failed/);
  const [completion] = completionRecordsIn(tenant.output);
  assert.deepEqual({ tenantId: completion?.tenantId, subject: completion?.subject, status: completion?.status }, { tenantId, subject: user.id, status: 'fetch_failed' });
  const captured = JSON.parse(/Relayed audit event captured: (\{.*\})$/m.exec(controlPlane.output)?.[1] ?? '{}') as Record<string, unknown>;
  assert.deepEqual(captured, { organizationId: tenantId, operationId: completion?.operationId, status: 'fetch_failed' });
  assert.match(controlPlane.output, new RegExp(`Test registry recorded the activity of ${tenantOrganizationId}`));
  assert.doesNotMatch(controlPlane.output, /Audit relay refusal|MCP gateway refusal|MCP gateway tenant restart/);
  assert.equal(completionRecordsIn(controlPlane.output).length, 0, 'The control plane ran no tool: the tenant did.');
  assert.equal(tenant.attemptedOutboundAccess, false, tenant.output);
  assert.equal(controlPlane.attemptedOutboundAccess, false, controlPlane.output);
  // Both roles stop with SIGTERM, as a deployment stops them, and exit normally.
  await client.close();
  assert.equal((await controlPlane.stop()).code, 0, controlPlane.output);
  assert.equal((await tenant.stop()).code, 0, tenant.output);
});
