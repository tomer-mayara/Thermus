import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { describe, test } from 'node:test';
import { hostedFetchSettings, workOSSettings } from '../../support/fixtures/hosted-placeholder.ts';
import { gatewayKeyPairOf, gatewaySigningSettingsOf } from '../../support/fixtures/hosted-tenant.ts';
import { ServerProcess, type ServerSettings } from '../../support/processes/server-process.ts';

// The built server of the control plane with the switch MCP_TENANTS_ENABLED (SO-05) and outbound access denied.
// FREE_TENANT_LIMIT, GATEWAY_SIGNING_KEY, and CONTROL_PLANE_INTERNAL_URL are read only with the switch on.
// hosted-startup.test.ts holds the other start cases of the hosted edition.

const hostedSettings: ServerSettings = {
  ...hostedFetchSettings,
  DEPLOYMENT: 'hosted',
  PUBLIC_BASE_URL: 'https://thermus.example',
  LISTEN_HOST: '127.0.0.1',
  LISTEN_PORT: '0',
};
const gatewaySettings = gatewaySigningSettingsOf();

async function assertStopsBeforeListening(server: ServerProcess, message: RegExp): Promise<void> {
  assert.equal(await server.listeningOrExit(), undefined, server.output);
  assert.notEqual((await server.exited()).code, 0);
  assert.match(server.output, message);
}

describe('Hosted control plane with MCP_TENANTS_ENABLED', () => {
  test('Given MCP_TENANTS_ENABLED=true and an invalid FREE_TENANT_LIMIT, when the server starts, then it stops before it listens with a FATAL line that names the setting and the rule but not the value', { timeout: 60_000 }, async (t) => {
    const freeTenantRule = /FATAL\S* (?:\[[^\]]*\]: )?FREE_TENANT_LIMIT must be a whole number from 0 to 1000\.$/m;
    for (const value of ['1001', '2.5', 'abc', ' 25', '1e3']) {
      const server = ServerProcess.launch(t, { ...hostedSettings, ...workOSSettings, ...gatewaySettings, MCP_TENANTS_ENABLED: 'true', FREE_TENANT_LIMIT: value });

      await assertStopsBeforeListening(server, freeTenantRule);
      assert.ok(!server.output.includes(value), server.output);
    }
  });

  test('Given MCP_TENANTS_ENABLED with a value other than true or false, or on with a missing or invalid gateway setting, when the server starts, then it stops before it listens with a FATAL line that names the setting and the rule but not the value', { timeout: 60_000 }, async (t) => {
    const rsaKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const invalidSettings: ReadonlyArray<[ServerSettings, RegExp]> = [
      [{ MCP_TENANTS_ENABLED: 'yes' }, /FATAL\S* (?:\[[^\]]*\]: )?MCP_TENANTS_ENABLED must be exactly true or false\.$/m],
      [{ ...gatewaySettings, MCP_TENANTS_ENABLED: 'true', GATEWAY_SIGNING_KEY: '' }, /FATAL\S* (?:\[[^\]]*\]: )?GATEWAY_SIGNING_KEY is required when MCP_TENANTS_ENABLED is true\.$/m],
      [{ ...gatewaySettings, MCP_TENANTS_ENABLED: 'true', GATEWAY_SIGNING_KEY: gatewayKeyPairOf().publicKeyPem }, /FATAL\S* (?:\[[^\]]*\]: )?GATEWAY_SIGNING_KEY must be one PEM private key of type Ed25519\.$/m],
      [{ ...gatewaySettings, MCP_TENANTS_ENABLED: 'true', GATEWAY_SIGNING_KEY: rsaKey }, /FATAL\S* (?:\[[^\]]*\]: )?GATEWAY_SIGNING_KEY must be one PEM private key of type Ed25519\.$/m],
      [{ ...gatewaySettings, MCP_TENANTS_ENABLED: 'true', CONTROL_PLANE_INTERNAL_URL: '' }, /FATAL\S* (?:\[[^\]]*\]: )?CONTROL_PLANE_INTERNAL_URL is required when MCP_TENANTS_ENABLED is true\.$/m],
      [{ ...gatewaySettings, MCP_TENANTS_ENABLED: 'true', CONTROL_PLANE_INTERNAL_URL: 'http://thermus-control-plane:8080/private-path' }, /FATAL\S* (?:\[[^\]]*\]: )?CONTROL_PLANE_INTERNAL_URL must be the http or https origin of the control plane/m],
    ];

    for (const [overrides, message] of invalidSettings) {
      const server = ServerProcess.launch(t, { ...hostedSettings, ...workOSSettings, ...overrides });

      await assertStopsBeforeListening(server, message);
      for (const name of ['GATEWAY_SIGNING_KEY', 'CONTROL_PLANE_INTERNAL_URL']) {
        const value = overrides[name];
        if (value !== undefined && value !== '') assert.ok(!server.output.includes(value.trim().split('\n')[1] ?? value), server.output);
      }
      assert.ok(!server.output.includes('private-path'), server.output);
      assert.equal(server.attemptedOutboundAccess, false, server.output);
    }
  });

  test('Given MCP_TENANTS_ENABLED=true and valid gateway settings without the private hosted storage, when the server starts, then it stops before it listens, because the gateway needs the tenant registry', { timeout: 60_000 }, async (t) => {
    const server = ServerProcess.launch(t, { ...hostedSettings, ...workOSSettings, ...gatewaySettings, MCP_TENANTS_ENABLED: 'true' });

    await assertStopsBeforeListening(server, /FATAL.*MCP_TENANTS_ENABLED=true needs the tenant registry: DATABASE_URL and LOGGING_DESTINATION_ENCRYPTION_KEY must be valid\./);
    assert.ok(!server.output.includes(gatewaySettings.GATEWAY_SIGNING_KEY?.split('\n')[1] ?? 'no key'), 'The output shows no part of the signing key');
    assert.equal(server.attemptedOutboundAccess, false, server.output);
  });

  test('Given MCP_TENANTS_ENABLED off, also with an invalid FREE_TENANT_LIMIT and invalid gateway settings, when the server starts, then it listens and reads none of them', { timeout: 60_000 }, async (t) => {
    const unread = { FREE_TENANT_LIMIT: 'not-a-number', GATEWAY_SIGNING_KEY: 'not-a-key', CONTROL_PLANE_INTERNAL_URL: 'not-a-url' };
    const listTools = { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) };
    for (const MCP_TENANTS_ENABLED of ['false', '']) {
      const server = await ServerProcess.start(t, { ...hostedSettings, ...workOSSettings, ...unread, MCP_TENANTS_ENABLED });
      const mcp = await server.request('/mcp', listTools);
      await mcp.body?.cancel();
      await server.stop();

      assert.equal(mcp.status, 401);
      assert.doesNotMatch(server.output, /FATAL|FREE_TENANT_LIMIT|GATEWAY_SIGNING_KEY|CONTROL_PLANE_INTERNAL_URL/);
      assert.equal(server.attemptedOutboundAccess, false, server.output);
    }
  });
});
