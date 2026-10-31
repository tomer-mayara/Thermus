import assert from 'node:assert/strict';
import { generateKeyPairSync, type KeyObject } from 'node:crypto';
import { test } from 'node:test';
import { DeploymentConfigError, loadDeploymentConfig } from '../../../src/runtime/config/deployment-config.ts';

type Environment = Record<string, string | undefined>;

const gatewayKey = generateKeyPairSync('ed25519');
const rotatedGatewayKey = generateKeyPairSync('ed25519');
const publicPem = (key: KeyObject): string => key.export({ type: 'spki', format: 'pem' }).toString();
const tenant: Environment = {
  DEPLOYMENT: 'hosted',
  THERMUS_ROLE: 'tenant',
  PUBLIC_BASE_URL: 'https://thermus.example',
  TENANT_ORGANIZATION_ID: 'org_01PINNED',
  GATEWAY_PUBLIC_KEY: publicPem(gatewayKey.publicKey),
  CONTROL_PLANE_INTERNAL_URL: 'http://thermus-control-plane:8080',
  WORKOS_AUTHKIT_ISSUER: 'https://thermus-test.authkit.app',
};
const refusedTenantSettings = ['WORKOS_API_KEY', 'WORKOS_CLIENT_SECRET', 'WORKOS_COOKIE_PASSWORD', 'GATEWAY_SIGNING_KEY', 'DATABASE_URL', 'LOGGING_DESTINATION_ENCRYPTION_KEY', 'RENDER_API_KEY', 'SYSTEM_LOG_OTLP_TOKEN', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_TEAM'];
const rootUrls = { publicBaseUrl: 'https://thermus.example/', mcpResourceUrl: 'https://thermus.example/mcp',
  resourceMetadataUrl: 'https://thermus.example/.well-known/oauth-protected-resource/mcp' };

// The message of a refused start, which must hold no value of a tenant setting or a refused secret.
function rejectionMessage(settings: Environment, transport: 'http' | 'stdio' = 'http'): string {
  let message = '';
  assert.throws(() => loadDeploymentConfig(settings, transport), (error) => {
    assert.ok(error instanceof DeploymentConfigError, `Expected a DeploymentConfigError, got ${String(error)}`);
    message = error.message;
    return true;
  });
  const values = [...Object.keys(tenant), ...refusedTenantSettings].filter((name) => name !== 'DEPLOYMENT' && name !== 'THERMUS_ROLE').map((name) => settings[name] ?? '');
  assert.deepEqual(values.filter((value) => value !== '' && message.includes(value)), [], 'The message must not contain a setting value.');
  return message;
}

for (const role of [undefined, '', 'control-plane']) {
  test(`Given a valid hosted environment with ${role === undefined ? 'no THERMUS_ROLE' : `THERMUS_ROLE=${JSON.stringify(role)}`}, when it loads, then it selects the control plane`, () => {
    const config = loadDeploymentConfig({ DEPLOYMENT: 'hosted', PUBLIC_BASE_URL: 'https://thermus.example', THERMUS_ROLE: role }, 'http');
    assert.deepEqual(config, { deployment: 'hosted', role: 'control-plane', ...rootUrls });
  });
}

test('Given a valid tenant environment, when it loads, then the record, its tenant settings, and its keys are frozen', () => {
  const config = tenantOf();
  assert.deepEqual([Object.isFrozen(config), Object.isFrozen(config.tenant), Object.isFrozen(config.tenant.gatewayPublicKeys)], [true, true, true]);
});

function tenantOf(overrides: Environment = {}) {
  const config = loadDeploymentConfig({ ...tenant, ...overrides }, 'http');
  assert.ok(config.deployment === 'hosted' && config.role === 'tenant', 'The settings did not select the tenant role.');
  return config;
}

test('Given THERMUS_ROLE=tenant with its four settings, when it loads, then it selects the tenant role pinned to the organization, with the public keys, the internal address of the control plane, and the AuthKit issuer', () => {
  const { tenant: settings, ...config } = tenantOf();

  assert.deepEqual(config, { deployment: 'hosted', role: 'tenant', ...rootUrls });
  assert.deepEqual({ ...settings, gatewayPublicKeys: settings.gatewayPublicKeys.map(publicPem) }, {
    organizationId: 'org_01PINNED',
    gatewayPublicKeys: [publicPem(gatewayKey.publicKey)],
    controlPlaneInternalUrl: 'http://thermus-control-plane:8080/',
    authkitIssuer: 'https://thermus-test.authkit.app',
  });
});

test('Given GATEWAY_PUBLIC_KEY with two PEM public keys separated by a comma, when the tenant role loads, then it keeps both keys in their order, for a key rotation', () => {
  const pems = [publicPem(rotatedGatewayKey.publicKey), publicPem(gatewayKey.publicKey)];

  assert.deepEqual(tenantOf({ GATEWAY_PUBLIC_KEY: pems.join(',') }).tenant.gatewayPublicKeys.map(publicPem), pems);
  assert.deepEqual(tenantOf({ GATEWAY_PUBLIC_KEY: ` ${pems.join(' ,\n')}\n` }).tenant.gatewayPublicKeys.map(publicPem), pems);
});

test('Given CONTROL_PLANE_INTERNAL_URL with a final slash or with https, when the tenant role loads, then it keeps the origin with a final slash', () => {
  assert.equal(tenantOf({ CONTROL_PLANE_INTERNAL_URL: 'http://thermus-control-plane:8080/' }).tenant.controlPlaneInternalUrl, 'http://thermus-control-plane:8080/');
  assert.equal(tenantOf({ CONTROL_PLANE_INTERNAL_URL: 'https://control.example' }).tenant.controlPlaneInternalUrl, 'https://control.example/');
});

test('Given a valid tenant environment, when it loads, then it reads the tenant settings and checks the refused settings, but reads no other setting', () => {
  const read = new Set<string>();
  const settings = new Proxy({ ...tenant, LISTEN_PORT: '8080', OPERATION_CAPACITY: '5', SELF_SERVE_SIGNUP_ENABLED: 'true' }, {
    get: (target, name) => { read.add(String(name)); return Reflect.get(target, name); },
  });

  loadDeploymentConfig(settings, 'http');

  assert.deepEqual([...read].filter((name) => !refusedTenantSettings.includes(name)).sort(), [
    'CONTROL_PLANE_INTERNAL_URL', 'DEPLOYMENT', 'GATEWAY_PUBLIC_KEY', 'PUBLIC_BASE_URL', 'TENANT_ORGANIZATION_ID', 'THERMUS_ROLE', 'WORKOS_AUTHKIT_ISSUER',
  ]);
});

for (const role of ['worker', 'Tenant', ' tenant', 'tenant ', 'control_plane', 'controlplane']) {
  test(`Given THERMUS_ROLE=${JSON.stringify(role)}, when the hosted edition loads, then it stops with a message that names the setting and its values`, () => {
    assert.equal(rejectionMessage({ ...tenant, THERMUS_ROLE: role }), 'THERMUS_ROLE must be control-plane or tenant.');
  });
}

for (const name of ['TENANT_ORGANIZATION_ID', 'GATEWAY_PUBLIC_KEY', 'CONTROL_PLANE_INTERNAL_URL', 'WORKOS_AUTHKIT_ISSUER']) {
  for (const value of [undefined, '']) {
    test(`Given THERMUS_ROLE=tenant with ${value === undefined ? 'no' : 'an empty'} ${name}, when it loads, then it stops with a message that names the setting`, () => {
      assert.equal(rejectionMessage({ ...tenant, [name]: value }), `${name} is required.`);
    });
  }
}

for (const name of refusedTenantSettings) {
  test(`Given THERMUS_ROLE=tenant with ${name}, when it loads, then it refuses the start with a message that names the setting but not its value`, () => {
    assert.equal(rejectionMessage({ ...tenant, [name]: `private-value-of-${name}` }), `The tenant role refuses ${name}: a tenant holds no secret of the control plane. Remove it from the tenant environment.`);
  });
}

test('Given THERMUS_ROLE=tenant with several refused settings, when it loads, then one message names each of them in order', () => {
  assert.equal(rejectionMessage({ ...tenant, STRIPE_SECRET_KEY: 'sk_live_private', DATABASE_URL: 'postgresql://private', WORKOS_API_KEY: 'sk_test_private' }),
    'The tenant role refuses DATABASE_URL, STRIPE_SECRET_KEY, WORKOS_API_KEY: a tenant holds no secret of the control plane. Remove them from the tenant environment.');
});

test('Given THERMUS_ROLE=tenant with an empty refused setting, when it loads, then the empty value holds no secret and the start continues', () => {
  assert.equal(tenantOf({ WORKOS_API_KEY: '', STRIPE_SECRET_KEY: '' }).role, 'tenant');
});

const keyRule = 'GATEWAY_PUBLIC_KEY must hold one or more PEM public keys of type Ed25519, separated by commas.';
const internalUrlRule = 'CONTROL_PLANE_INTERNAL_URL must be the http or https origin of the control plane on the private network, such as http://thermus-control-plane:8080, without a path, a username, a password, a query, or a fragment.';
const issuerRule = 'WORKOS_AUTHKIT_ISSUER must be the https origin of the AuthKit domain, such as https://example.authkit.app, without a path, a final slash, a username, a password, a query, or a fragment.';
const tenantRules: ReadonlyArray<[string, Environment, string]> = [
  ['an organization ID with a space', { TENANT_ORGANIZATION_ID: 'org 01' }, 'TENANT_ORGANIZATION_ID must have 1 to 256 visible ASCII characters.'],
  ['an organization ID of 257 characters', { TENANT_ORGANIZATION_ID: `org_${'a'.repeat(253)}` }, 'TENANT_ORGANIZATION_ID must have 1 to 256 visible ASCII characters.'],
  ['a gateway key that is not PEM', { GATEWAY_PUBLIC_KEY: 'not-a-key' }, keyRule],
  ['a gateway key list with an empty part', { GATEWAY_PUBLIC_KEY: `${publicPem(gatewayKey.publicKey)},` }, keyRule],
  ['a private gateway key', { GATEWAY_PUBLIC_KEY: gatewayKey.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() }, keyRule],
  ['a P-256 gateway key', { GATEWAY_PUBLIC_KEY: publicPem(generateKeyPairSync('ec', { namedCurve: 'P-256' }).publicKey) }, keyRule],
  ['two gateway keys without a comma', { GATEWAY_PUBLIC_KEY: `${publicPem(gatewayKey.publicKey)}${publicPem(rotatedGatewayKey.publicKey)}` }, keyRule],
  ...['ftp://control:21', 'http://control:8080/internal', 'http://control:8080/?a=1', 'http://operator:hunter2@control:8080', 'http://control:8080#top', 'control:8080', 'http://control 8080']
    .map((value): [string, Environment, string] => [`the internal URL ${value}`, { CONTROL_PLANE_INTERNAL_URL: value }, internalUrlRule]),
  ...['http://thermus-test.authkit.app', 'https://thermus-test.authkit.app/', 'https://thermus-test.authkit.app/oauth2', 'https://operator:hunter2@thermus-test.authkit.app']
    .map((value): [string, Environment, string] => [`the AuthKit issuer ${value}`, { WORKOS_AUTHKIT_ISSUER: value }, issuerRule]),
  ['a base URL with a path', { PUBLIC_BASE_URL: 'https://thermus.example/team/' }, 'The tenant role requires PUBLIC_BASE_URL with the base path /.'],
  ['a base URL with http', { PUBLIC_BASE_URL: 'http://thermus.example' }, 'PUBLIC_BASE_URL must use https.'],
];
for (const [label, overrides, message] of tenantRules) {
  test(`Given THERMUS_ROLE=tenant with ${label}, when it loads, then it stops with the rule of the setting and no value`, () => {
    assert.equal(rejectionMessage({ ...tenant, ...overrides }), message);
  });
}

test('Given a valid tenant environment, when it loads for stdio, then it rejects stdio because hosted MCP uses HTTPS only', () => {
  assert.match(rejectionMessage(tenant, 'stdio'), /^The hosted DEPLOYMENT serves MCP only over HTTPS, not stdio\./);
});
