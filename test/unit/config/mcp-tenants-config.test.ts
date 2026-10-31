import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { test } from 'node:test';
import { DeploymentConfigError } from '../../../src/runtime/config/deployment-config.ts';
import { loadMcpTenantsEnabled, loadTenantNamePrefix, loadTenantProvisioningSettings } from '../../../src/runtime/config/mcp-tenants-config.ts';

const ed25519 = (): string => generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' }).toString();
const gatewayKey = ed25519();
const image = `ghcr.io/tomer-mayara/thermus-hosted@sha256:${'ab'.repeat(32)}`;

const valid: Readonly<Record<string, string>> = {
  RENDER_API_KEY: 'rnd_unitTestKey0123456789',
  RENDER_OWNER_ID: 'tea-db8i6ceq1p3s73dev9og',
  RENDER_REGISTRY_CREDENTIAL_ID: 'rgc-dbg1h0142hec73da9ra0',
  TENANT_IMAGE: image,
  TENANT_PLAN_FREE: '0.5c-512mb',
  GATEWAY_PUBLIC_KEY: gatewayKey,
  CONTROL_PLANE_INTERNAL_URL: 'http://thermus-control-plane:8080',
};

function refusal(environment: Readonly<Record<string, string | undefined>>, message: string): void {
  assert.throws(() => loadTenantProvisioningSettings(environment), (error: unknown) => {
    assert.ok(error instanceof DeploymentConfigError);
    assert.equal(error.message, message);
    return true;
  });
}

test('Given no MCP_TENANTS_ENABLED, an empty value, or false, when the switch is loaded, then it is off', () => {
  assert.equal(loadMcpTenantsEnabled({}), false);
  assert.equal(loadMcpTenantsEnabled({ MCP_TENANTS_ENABLED: '' }), false);
  assert.equal(loadMcpTenantsEnabled({ MCP_TENANTS_ENABLED: 'false' }), false);
  assert.equal(loadMcpTenantsEnabled({ MCP_TENANTS_ENABLED: 'true' }), true);
});

for (const value of ['TRUE', 'True', 'yes', '1', 'on', ' true', 'true ']) {
  test(`Given MCP_TENANTS_ENABLED ${JSON.stringify(value)}, when the switch is loaded, then it stops with the rule and without the value`, () => {
    assert.throws(() => loadMcpTenantsEnabled({ MCP_TENANTS_ENABLED: value }), (error: unknown) => {
      assert.ok(error instanceof DeploymentConfigError);
      assert.equal(error.message, 'MCP_TENANTS_ENABLED must be exactly true or false.');
      return true;
    });
  });
}

test('Given valid tenant settings, when they are loaded, then they give the Render settings, the free plan, the default name prefix, and the public values of each new tenant', () => {
  assert.deepEqual(loadTenantProvisioningSettings({ ...valid, WORKOS_API_KEY: 'sk_test_unrelated' }), {
    render: { apiKey: 'rnd_unitTestKey0123456789', ownerId: 'tea-db8i6ceq1p3s73dev9og', registryCredentialId: 'rgc-dbg1h0142hec73da9ra0', tenantImage: image },
    freePlan: '0.5c-512mb',
    namePrefix: 'thermus-tenant-',
    gatewayPublicKey: gatewayKey,
    controlPlaneInternalUrl: 'http://thermus-control-plane:8080',
    sweepHourUtc: 4,
  });
});

test('Given TENANT_SWEEP_HOUR_UTC, when the settings are loaded, then they give the hour of the daily tick, and an invalid hour stops with its rule', () => {
  assert.equal(loadTenantProvisioningSettings({ ...valid, TENANT_SWEEP_HOUR_UTC: '0' }).sweepHourUtc, 0);
  assert.equal(loadTenantProvisioningSettings({ ...valid, TENANT_SWEEP_HOUR_UTC: '23' }).sweepHourUtc, 23);
  refusal({ ...valid, TENANT_SWEEP_HOUR_UTC: '24' }, 'TENANT_SWEEP_HOUR_UTC must be a whole number from 0 to 23.');
});

test('Given TENANT_NAME_PREFIX alone, when the prefix is loaded for the fleet script, then it follows the rule of the provisioning settings', () => {
  assert.equal(loadTenantNamePrefix({}), 'thermus-tenant-');
  assert.equal(loadTenantNamePrefix({ TENANT_NAME_PREFIX: 'thermus-spike-tenant-' }), 'thermus-spike-tenant-');
  assert.throws(() => loadTenantNamePrefix({ TENANT_NAME_PREFIX: 'Thermus_' }), /^DeploymentConfigError: TENANT_NAME_PREFIX must start with a lowercase letter/);
});

test('Given TENANT_NAME_PREFIX, two gateway keys, and an internal URL with a final slash, when the settings are loaded, then they keep the prefix and the keys and give the origin', () => {
  const keys = `${gatewayKey},\n${ed25519()}`;
  const settings = loadTenantProvisioningSettings({ ...valid, TENANT_NAME_PREFIX: 'thermus-spike-tenant-', GATEWAY_PUBLIC_KEY: keys, CONTROL_PLANE_INTERNAL_URL: 'http://thermus-spike-control:8080/' });
  assert.equal(settings.namePrefix, 'thermus-spike-tenant-');
  assert.equal(settings.gatewayPublicKey, keys);
  assert.equal(settings.controlPlaneInternalUrl, 'http://thermus-spike-control:8080');
  assert.equal(loadTenantProvisioningSettings({ ...valid, TENANT_NAME_PREFIX: '' }).namePrefix, 'thermus-tenant-');
});

for (const name of ['RENDER_API_KEY', 'RENDER_OWNER_ID', 'RENDER_REGISTRY_CREDENTIAL_ID', 'TENANT_IMAGE', 'TENANT_PLAN_FREE', 'GATEWAY_PUBLIC_KEY', 'CONTROL_PLANE_INTERNAL_URL']) {
  test(`Given no ${name} or an empty value, when the settings are loaded, then the start stops with a message that names it`, () => {
    refusal({ ...valid, [name]: undefined }, `${name} is required when MCP_TENANTS_ENABLED is true.`);
    refusal({ ...valid, [name]: '' }, `${name} is required when MCP_TENANTS_ENABLED is true.`);
  });
}

const rules: Readonly<Record<string, string>> = {
  RENDER_API_KEY: 'RENDER_API_KEY must not contain spaces or control characters.',
  RENDER_OWNER_ID: 'RENDER_OWNER_ID must be the ID of a Render workspace, such as tea-<lowercase letters and digits>.',
  RENDER_REGISTRY_CREDENTIAL_ID: 'RENDER_REGISTRY_CREDENTIAL_ID must be the ID of a Render registry credential, such as rgc-<lowercase letters and digits>.',
  TENANT_IMAGE: 'TENANT_IMAGE must be an image reference by digest, such as ghcr.io/owner/name@sha256:<64 hexadecimal digits>.',
  TENANT_PLAN_FREE: 'TENANT_PLAN_FREE must be the name of a Render plan, such as 0.5c-512mb.',
  TENANT_NAME_PREFIX: 'TENANT_NAME_PREFIX must start with a lowercase letter and hold at most 40 lowercase letters, digits, or hyphens.',
  GATEWAY_PUBLIC_KEY: 'GATEWAY_PUBLIC_KEY must hold one or more PEM public keys of type Ed25519, separated by commas.',
  CONTROL_PLANE_INTERNAL_URL: 'CONTROL_PLANE_INTERNAL_URL must be the http or https origin of the control plane on the private network, such as http://thermus-control-plane:8080, without a path, a username, a password, a query, or a fragment.',
};

const rsaKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey.export({ type: 'spki', format: 'pem' }).toString();
const privateKey = generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const invalidValues: readonly (readonly [string, string])[] = [
  ['RENDER_API_KEY', 'rnd key'], ['RENDER_API_KEY', 'rnd_key\n'],
  ['RENDER_OWNER_ID', 'srv-db8mnqg473hc739d529g'], ['RENDER_OWNER_ID', 'tea-ABC'], ['RENDER_OWNER_ID', 'tea-'],
  ['RENDER_REGISTRY_CREDENTIAL_ID', 'ghcr-thermus-hosted-read'], ['RENDER_REGISTRY_CREDENTIAL_ID', 'rgc-a/b'],
  ['TENANT_IMAGE', 'ghcr.io/tomer-mayara/thermus-hosted:latest'], ['TENANT_IMAGE', `ghcr.io/tomer-mayara/thermus-hosted@sha256:${'ab'.repeat(31)}`],
  ['TENANT_PLAN_FREE', '0.5c 512mb'], ['TENANT_PLAN_FREE', 'Starter'],
  ['TENANT_NAME_PREFIX', 'Thermus-'], ['TENANT_NAME_PREFIX', '-thermus'], ['TENANT_NAME_PREFIX', 'thermus_tenant_'], ['TENANT_NAME_PREFIX', `t${'a'.repeat(40)}`],
  ['GATEWAY_PUBLIC_KEY', 'not a key'], ['GATEWAY_PUBLIC_KEY', rsaKey], ['GATEWAY_PUBLIC_KEY', privateKey], ['GATEWAY_PUBLIC_KEY', `${gatewayKey},`],
  ['CONTROL_PLANE_INTERNAL_URL', 'http://thermus-control-plane:8080/internal'], ['CONTROL_PLANE_INTERNAL_URL', 'http://operator:secret@thermus-control-plane:8080'],
  ['CONTROL_PLANE_INTERNAL_URL', 'http://thermus-control-plane:8080?x=1'], ['CONTROL_PLANE_INTERNAL_URL', 'ftp://thermus-control-plane:8080'], ['CONTROL_PLANE_INTERNAL_URL', 'thermus-control-plane:8080'],
];

for (const [name, value] of invalidValues) {
  test(`Given ${name} ${JSON.stringify(value.slice(0, 40))}, when the settings are loaded, then the start stops with the rule of the setting and without the value`, () => {
    refusal({ ...valid, [name]: value }, rules[name] ?? '');
  });
}
