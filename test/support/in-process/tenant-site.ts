import type { TestContext } from 'node:test';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createApplication } from '../../../src/app/application.ts';
import { loadDeploymentConfig } from '../../../src/runtime/config/deployment-config.ts';
import { startHttpServer } from '../../../src/runtime/http/server.ts';
import { hostedFetchSettings, workOSSettings } from '../fixtures/hosted-placeholder.ts';
import { controlPlaneAuthority, gatewayKeyPairOf, tenantOrganizationId, tenantSettingsOf } from '../fixtures/hosted-tenant.ts';
import { AuditRelayRouteSpy } from '../doubles/logging/audit-relay-route-spy.ts';
import { SigningKey } from '../doubles/workos/jwt-signing-key.ts';
import { WorkOSFakeApi } from '../doubles/workos/workos-fake-api.ts';
import { connectMcpClient } from '../drivers/mcp/mcp-sdk-client.ts';
import type { McpProtocolEra } from '../drivers/mcp/mcp-protocol-eras.ts';
import { SignedContextGateway } from '../drivers/mcp/signed-context-gateway.ts';
import { completionRecordsIn } from '../drivers/operator-log.ts';

export const tenantUser = 'user_01TENANTUSER';
const userGrants = [{ role: 'user', permissions: ['product:access'] }];

// The production composition of the hosted image in the tenant role, from the same settings and entry as the server
// process. The fetch seam routes only the AuthKit key set to a local fake. The relay of the tenant reaches the relay
// route spy on a loopback port, and the test plays the gateway that signs a context for each request.
export async function openTenantSite(t: TestContext, settings: Readonly<Record<string, string>> = {}) {
  const authkit = await WorkOSFakeApi.start(t);
  const authkitKey = await SigningKey.generate('authkit-key-1');
  authkit.authkitKeySet.publish(authkitKey);
  const actualFetch = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', (async (input, init) => {
    const target = new URL(input instanceof Request ? input.url : String(input));
    if (target.origin === workOSSettings.WORKOS_AUTHKIT_ISSUER) return actualFetch(authkit.authkitKeySetUrl, init);
    if (target.hostname === '127.0.0.1') return actualFetch(input, init);
    throw new Error('Unexpected outbound request');
  }) as typeof fetch);
  const relay = await AuditRelayRouteSpy.start(t);
  const keys = gatewayKeyPairOf();
  const lines: string[] = [];
  const logger = { info: (line: string) => { lines.push(line); }, error: (line: string) => { lines.push(line); } };
  const environment = { ...hostedFetchSettings, ...tenantSettingsOf(keys.publicKeyPem, relay.origin), ...settings };
  const config = loadDeploymentConfig(environment, 'http');
  const application = await createApplication(config, logger, environment);
  const listener = await startHttpServer(application.handle, { listen: { host: '127.0.0.1', port: 0 }, publicBaseUrl: config.publicBaseUrl });
  t.after(async () => { const draining = listener.close(); await application.close(draining); });
  const gateway = new SignedContextGateway(keys.privateKey, { authority: controlPlaneAuthority, subject: tenantUser, organizationId: tenantOrganizationId, grants: userGrants });
  const mcpUrl = new URL('mcp', listener.url);
  return {
    config, relay, gateway, lines, mcpUrl,
    // A Connect user token of the AuthKit issuer for the public MCP resource. Another key gives a token without a
    // valid AuthKit signature.
    token: (claims: Readonly<Record<string, unknown>> = {}, key = authkitKey): Promise<string> => key.sign(
      { sub: tenantUser, client_id: 'client_01TENANTMCP', sid: 'app_consent_01TENANT', scope: 'openid', org_id: tenantOrganizationId, ...claims },
      { issuer: workOSSettings.WORKOS_AUTHKIT_ISSUER, audience: config.mcpResourceUrl },
    ),
    connect: async (token: string, era: McpProtocolEra = '2026-07-28') => {
      const transport = new StreamableHTTPClientTransport(mcpUrl, { authProvider: { token: async () => token }, fetch: gateway.fetchFor(token) });
      const client = await connectMcpClient(t, transport, { era, probe: era === '2026-07-28' });
      t.after(() => client.close());
      return client;
    },
    request: (path: string, init: RequestInit = {}): Promise<Response> => fetch(new URL(path, listener.url), init),
    completions: () => completionRecordsIn(lines.join('\n')),
  };
}
