import assert from 'node:assert/strict';
import { generateKeyPairSync, type KeyObject } from 'node:crypto';
import { test } from 'node:test';
import { DeploymentConfigError, loadDeploymentConfig, loadPublicUrls, type DeploymentConfig } from '../../../src/runtime/config/deployment-config.ts';
import { workOSSettings } from '../../support/fixtures/hosted-placeholder.ts';

type Environment = Record<string, string | undefined>;
type Edition = DeploymentConfig['deployment'];

const valid: Readonly<Record<Edition, Environment>> = {
  'self-hosted': { DEPLOYMENT: 'self-hosted', PUBLIC_BASE_URL: 'https://thermus.example', DATA_DIR: '/var/lib/thermus' },
  hosted: { DEPLOYMENT: 'hosted', PUBLIC_BASE_URL: 'https://thermus.example' },
};
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
const refusedTenantSettings = ['WORKOS_API_KEY', 'WORKOS_CLIENT_SECRET', 'WORKOS_COOKIE_PASSWORD', 'GATEWAY_SIGNING_KEY', 'DATABASE_URL', 'LOGGING_DESTINATION_ENCRYPTION_KEY', 'RENDER_API_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_TEAM'];
const valueSettings = Object.keys({ ...valid['self-hosted'], ...valid.hosted, ...workOSSettings, ...tenant })
  .filter((name) => name !== 'DEPLOYMENT' && name !== 'THERMUS_ROLE')
  .concat(refusedTenantSettings);
const rootUrls = { publicBaseUrl: 'https://thermus.example/', mcpResourceUrl: 'https://thermus.example/mcp',
  resourceMetadataUrl: 'https://thermus.example/.well-known/oauth-protected-resource/mcp' };

function environment(edition: Edition, overrides: Environment = {}): Environment {
  return { ...valid[edition], ...overrides };
}

function load(edition: Edition, overrides: Environment = {}): DeploymentConfig {
  return loadDeploymentConfig(environment(edition, overrides), 'http');
}

function assignments(settings: Environment): string {
  return Object.entries(settings).map(([name, value]) => `${name}=${value ?? '(missing)'}`).join(' and ');
}

function rejectionMessage(settings: Environment, transport: 'http' | 'stdio' = 'http'): string {
  let message = '';
  assert.throws(() => loadDeploymentConfig(settings, transport), (error) => {
    assert.ok(error instanceof DeploymentConfigError, `Expected a DeploymentConfigError, got ${String(error)}`);
    message = error.message;
    return true;
  });
  const leaked = valueSettings.map((name) => settings[name] ?? '').filter((value) => value !== '' && message.includes(value));
  assert.deepEqual(leaked, [], 'The message must not contain a setting value.');
  return message;
}

test('Given a valid self-hosted environment, when it loads for HTTP, then it returns the derived URLs and the data directory', () => {
  assert.deepEqual(load('self-hosted'), { deployment: 'self-hosted', ...rootUrls, dataDirectory: '/var/lib/thermus' } satisfies DeploymentConfig);
});

test('Given a valid hosted environment without WorkOS settings and without THERMUS_ROLE, when it loads for HTTP, then it selects the control plane of the hosted edition with only the derived URLs', () => {
  assert.deepEqual(load('hosted'), { deployment: 'hosted', role: 'control-plane', ...rootUrls } satisfies DeploymentConfig);
});

for (const role of ['', 'control-plane']) {
  test(`Given a valid hosted environment with THERMUS_ROLE=${JSON.stringify(role)}, when it loads, then it selects the control plane, as without the setting`, () => {
    assert.deepEqual(load('hosted', { THERMUS_ROLE: role }), load('hosted'));
  });
}

const derivedUrls: ReadonlyArray<[Edition, string, string, string, string]> = [
  ['self-hosted', 'http://localhost:8080', 'http://localhost:8080/', 'http://localhost:8080/mcp', 'http://localhost:8080/.well-known/oauth-protected-resource/mcp'],
  ['self-hosted', 'http://127.0.0.1:8080', 'http://127.0.0.1:8080/', 'http://127.0.0.1:8080/mcp', 'http://127.0.0.1:8080/.well-known/oauth-protected-resource/mcp'],
  ['self-hosted', 'http://[::1]:8080', 'http://[::1]:8080/', 'http://[::1]:8080/mcp', 'http://[::1]:8080/.well-known/oauth-protected-resource/mcp'],
  ['self-hosted', 'https://example.com/app', 'https://example.com/app/', 'https://example.com/app/mcp', 'https://example.com/.well-known/oauth-protected-resource/app/mcp'],
  ['hosted', 'https://example.com/app', 'https://example.com/app/', 'https://example.com/app/mcp', 'https://example.com/.well-known/oauth-protected-resource/app/mcp'],
  ['hosted', 'https://example.com/app/', 'https://example.com/app/', 'https://example.com/app/mcp', 'https://example.com/.well-known/oauth-protected-resource/app/mcp'],
];
for (const [edition, base, publicBaseUrl, mcpResourceUrl, resourceMetadataUrl] of derivedUrls) {
  test(`Given a ${edition} PUBLIC_BASE_URL of ${base}, when it loads, then it derives the exact MCP resource and metadata URLs`, () => {
    const config = load(edition, { PUBLIC_BASE_URL: base });
    assert.deepEqual([config.publicBaseUrl, config.mcpResourceUrl, config.resourceMetadataUrl], [publicBaseUrl, mcpResourceUrl, resourceMetadataUrl]);
  });
}

for (const [edition, base, publicBaseUrl, mcpResourceUrl, resourceMetadataUrl] of derivedUrls) {
  test(`Given only a PUBLIC_BASE_URL of ${base}, when the ${edition} public URLs load, then they are the exact base, MCP resource, and metadata URLs in a frozen record`, () => {
    const urls = loadPublicUrls({ PUBLIC_BASE_URL: base }, edition);
    assert.deepEqual(urls, { publicBaseUrl, mcpResourceUrl, resourceMetadataUrl });
    assert.ok(Object.isFrozen(urls));
  });
}

const publicUrlRejections: ReadonlyArray<[Edition, Environment, string]> = [
  ['self-hosted', { PUBLIC_BASE_URL: undefined }, 'PUBLIC_BASE_URL is required.'],
  ['hosted', { PUBLIC_BASE_URL: undefined }, 'PUBLIC_BASE_URL is required.'],
  ['hosted', { PUBLIC_BASE_URL: 'http://localhost:8080' }, 'PUBLIC_BASE_URL must use https.'],
  ['self-hosted', { PUBLIC_BASE_URL: 'http://thermus.example' }, 'PUBLIC_BASE_URL must use https. It can use http only on localhost, 127.0.0.1, or [::1].'],
];
for (const [edition, settings, message] of publicUrlRejections) {
  test(`Given ${assignments(settings)} and a valid PUBLIC_BASE_URL only in process.env, when the ${edition} public URLs load, then they ignore process.env and reject the setting by name and rule`, (context) => {
    context.mock.property(process, 'env', { PUBLIC_BASE_URL: 'https://thermus.example' });
    assert.throws(() => loadPublicUrls(settings, edition), { name: 'DeploymentConfigError', message });
  });
}

for (const edition of ['self-hosted', 'hosted'] as const) {
  for (const deployment of [undefined, '', 'local', 'Hosted', ' hosted', 'self-hosted ']) {
    const selector = deployment === undefined ? 'no DEPLOYMENT' : `DEPLOYMENT=${JSON.stringify(deployment)}`;
    test(`Given ${edition} settings with ${selector}, when it loads, then it rejects the edition selector`, () => {
      assert.match(rejectionMessage(environment(edition, { DEPLOYMENT: deployment })), /^DEPLOYMENT must be set to self-hosted or hosted\./);
    });
  }
}

const ignoredSettings: ReadonlyArray<[Edition, Environment]> = [
  ['hosted', { DATA_DIR: '/var/lib/thermus' }], ['hosted', { AUTH_MODE: 'mock' }], ['self-hosted', { AUTH_MODE: 'hosted' }],
  ['self-hosted', { AUTH_MODE: 'mock', ENABLE_PAID_FEATURES: 'true' }],
  ['self-hosted', { WORKOS_AUTHKIT_ISSUER: 'not-a-url', WORKOS_COOKIE_PASSWORD: 'short' }],
  ['hosted', workOSSettings], ['hosted', { WORKOS_AUTHKIT_ISSUER: 'not-a-url', WORKOS_COOKIE_PASSWORD: 'short', WORKOS_API_KEY: '' }],
  ['hosted', { ...workOSSettings, AUTH_MODE: 'workos', ENABLE_PAID_FEATURES: 'true' }],
  ['self-hosted', { THERMUS_ROLE: 'tenant' }], ['self-hosted', { THERMUS_ROLE: 'worker', TENANT_ORGANIZATION_ID: 'org_01PINNED' }],
  ['hosted', { TENANT_ORGANIZATION_ID: 'org_01PINNED', GATEWAY_PUBLIC_KEY: 'not-a-key', CONTROL_PLANE_INTERNAL_URL: 'not-a-url' }],
];
for (const [edition, extra] of ignoredSettings) {
  test(`Given a valid ${edition} environment with ${assignments(extra)}, when it loads, then those settings change nothing`, () => {
    assert.deepEqual(load(edition, extra), load(edition));
  });
}

const settingsRead: ReadonlyArray<[Edition, string]> = [
  ['self-hosted', 'DATA_DIR DEPLOYMENT PUBLIC_BASE_URL'],
  ['hosted', 'DEPLOYMENT PUBLIC_BASE_URL THERMUS_ROLE'],
];
for (const [edition, expected] of settingsRead) {
  test(`Given a valid ${edition} environment with WorkOS settings, when it loads, then it reads only the ${edition} settings`, () => {
    const read = new Set<string>();
    const settings = new Proxy(environment(edition, workOSSettings), {
      get: (target, name) => { read.add(String(name)); return Reflect.get(target, name); },
    });
    loadDeploymentConfig(settings, 'http');
    assert.equal([...read].sort().join(' '), expected);
  });
}

test('Given valid hosted settings only in process.env, when it loads an empty environment, then it ignores process.env', (context) => {
  context.mock.property(process, 'env', environment('hosted'));
  assert.match(rejectionMessage({}), /^DEPLOYMENT must be set/);
});

const urlSettings: ReadonlyArray<[Edition, string]> = [['self-hosted', 'PUBLIC_BASE_URL'], ['hosted', 'PUBLIC_BASE_URL']];
const brokenUrls: ReadonlyArray<[string, (url: string) => string]> = [
  ['must not contain spaces or control characters', (url) => `${url} `],
  ['must be an absolute URL', (url) => url.replace('https://', '')],
  ['must use https', (url) => url.replace('https:', 'ftp:')],
  ['must not contain a username or password', (url) => url.replace('https://', 'https://operator:hunter2@')],
  ['must not contain a fragment', (url) => `${url}#top`],
  ['must not contain a fragment', (url) => `${url}#`],
  ['must not contain a query', (url) => `${url}?tenant=acme`],
  ['must not contain a query', (url) => `${url}?`],
];
for (const [edition, setting] of urlSettings) {
  for (const [rule, breakUrl] of brokenUrls) {
    const value = breakUrl(String(valid[edition][setting]));
    test(`Given a ${edition} ${setting} of ${JSON.stringify(value)}, when it loads, then it rejects the URL because it ${rule}`, () => {
      assert.match(rejectionMessage(environment(edition, { ...workOSSettings, [setting]: value })), new RegExp(`^${setting} ${rule}\\.`));
    });
  }
}

const requiredSettings: ReadonlyArray<[Edition, string]> = [...urlSettings, ['self-hosted', 'DATA_DIR']];
for (const [edition, setting] of requiredSettings) {
  for (const value of [undefined, '']) {
    test(`Given a ${edition} environment with ${value === undefined ? 'no' : 'an empty'} ${setting}, when it loads, then it rejects the missing setting`, () => {
      assert.match(rejectionMessage(environment(edition, { [setting]: value })), new RegExp(`^${setting} is required\\.`));
    });
  }
}

const settingRules: ReadonlyArray<[Edition, Environment, RegExp]> = [
  ['hosted', { PUBLIC_BASE_URL: 'http://localhost:8080' }, /^PUBLIC_BASE_URL must use https\.$/],
  ['hosted', { PUBLIC_BASE_URL: 'http://127.0.0.1:8080' }, /^PUBLIC_BASE_URL must use https\.$/],
  ['hosted', { PUBLIC_BASE_URL: 'http://[::1]:8080' }, /^PUBLIC_BASE_URL must use https\.$/],
  ['hosted', { ...workOSSettings, PUBLIC_BASE_URL: 'http://localhost:8080', WORKOS_REDIRECT_URI: 'http://localhost:8080/callback' }, /^PUBLIC_BASE_URL must use https\.$/],
  ['self-hosted', { PUBLIC_BASE_URL: 'http://thermus.example' }, /^PUBLIC_BASE_URL must use https\. It can use http only on localhost, 127\.0\.0\.1, or \[::1\]\.$/],
  ['self-hosted', { PUBLIC_BASE_URL: 'http://localhost.thermus.example' }, /^PUBLIC_BASE_URL must use https\./],
  ['self-hosted', { PUBLIC_BASE_URL: 'http://192.168.1.20:8080' }, /^PUBLIC_BASE_URL must use https\./],
  ['self-hosted', { DATA_DIR: 'relative/thermus-data' }, /^DATA_DIR must be an absolute path\./],
  ['self-hosted', { DATA_DIR: './thermus-data' }, /^DATA_DIR must be an absolute path\./],
  ['hosted', { DEPLOYMENT: undefined, AUTH_MODE: 'hosted' }, /^DEPLOYMENT must be set to self-hosted or hosted\./],
  ['hosted', { DEPLOYMENT: undefined, ...workOSSettings }, /^DEPLOYMENT must be set to self-hosted or hosted\./],
  ['hosted', { AUTH_MODE: 'mock', PUBLIC_BASE_URL: undefined }, /^PUBLIC_BASE_URL is required\./],
  ['hosted', { AUTH_MODE: 'hosted', PUBLIC_BASE_URL: 'http://localhost:8080' }, /^PUBLIC_BASE_URL must use https\./],
  ['hosted', { ...workOSSettings, ENABLE_PAID_FEATURES: 'true', PUBLIC_BASE_URL: 'https://thermus.example?plan=paid' }, /^PUBLIC_BASE_URL must not contain a query\./],
  ['hosted', { ...workOSSettings, DATA_DIR: '/var/lib/thermus', PUBLIC_BASE_URL: undefined }, /^PUBLIC_BASE_URL is required\./],
];
for (const [edition, overrides, rule] of settingRules) {
  test(`Given a ${edition} environment with ${assignments(overrides)}, when it loads, then it rejects the invalid setting by name and rule`, () => {
    assert.match(rejectionMessage(environment(edition, overrides)), rule);
  });
}

test('Given a hosted base URL with a password and values for each WorkOS setting, when it loads, then the message names the rule but no secret, URL, or WorkOS value', () => {
  const url = 'https://operator:hunter2@thermus.example';
  const message = rejectionMessage(environment('hosted', { ...workOSSettings, PUBLIC_BASE_URL: url }));
  assert.match(message, /^PUBLIC_BASE_URL must not contain a username or password\./);
  for (const secret of [url, 'hunter2', ...Object.values(workOSSettings)]) assert.ok(!message.includes(String(secret)));
});

for (const settings of [{}, workOSSettings]) {
  test(`Given a valid hosted environment${settings === workOSSettings ? ' with WorkOS settings' : ''}, when it loads for stdio, then it rejects stdio because hosted MCP uses HTTPS only`, () => {
    assert.match(rejectionMessage(environment('hosted', settings), 'stdio'), /^The hosted DEPLOYMENT serves MCP only over HTTPS, not stdio\./);
  });
}

test('Given a valid self-hosted environment, when it loads for stdio, then it returns the same record as for HTTP', () => {
  assert.deepEqual(loadDeploymentConfig(environment('self-hosted'), 'stdio'), load('self-hosted'));
});

test('Given valid environments, when they load, then each record is frozen', () => {
  const tenantConfig = tenantOf();
  assert.deepEqual([Object.isFrozen(load('self-hosted')), Object.isFrozen(load('hosted')), Object.isFrozen(tenantConfig), Object.isFrozen(tenantConfig.tenant), Object.isFrozen(tenantConfig.tenant.gatewayPublicKeys)], [true, true, true, true, true]);
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
