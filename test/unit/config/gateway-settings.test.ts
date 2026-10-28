import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { test } from 'node:test';
import { DeploymentConfigError } from '../../../src/runtime/config/deployment-config.ts';
import { loadGatewaySettings, requireSigningKeyIn } from '../../../src/runtime/config/gateway-settings.ts';

const ed25519 = generateKeyPairSync('ed25519');
const signingKeyPem = ed25519.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const valid: Readonly<Record<string, string>> = { GATEWAY_SIGNING_KEY: signingKeyPem, CONTROL_PLANE_INTERNAL_URL: 'http://thermus-control-plane:8080' };
const keyRule = 'GATEWAY_SIGNING_KEY must be one PEM private key of type Ed25519.';
const urlRule = 'CONTROL_PLANE_INTERNAL_URL must be the http or https origin of the control plane on the private network, such as http://thermus-control-plane:8080, without a path, a username, a password, a query, or a fragment.';
const publicKeyPem = ed25519.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const otherPublicKeyPem = generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' }).toString();
const listedKeyRule = 'GATEWAY_PUBLIC_KEY must include the public key of GATEWAY_SIGNING_KEY.';

function refusal(environment: Readonly<Record<string, string | undefined>>, message: string): void {
  assert.throws(() => loadGatewaySettings(environment), (error: unknown) => {
    assert.ok(error instanceof DeploymentConfigError);
    assert.equal(error.message, message);
    return true;
  });
}

test('Given a PEM Ed25519 private key and the internal origin of the control plane, when the gateway settings are loaded, then they give the private key, its public key, and the origin without a final slash', () => {
  const settings = loadGatewaySettings({ ...valid, WORKOS_API_KEY: 'sk_test_unrelated' });

  assert.equal(settings.signingKey.type, 'private');
  assert.equal(settings.signingKey.asymmetricKeyType, 'ed25519');
  assert.equal(settings.signingKey.export({ type: 'pkcs8', format: 'pem' }).toString(), signingKeyPem);
  assert.equal(settings.verifyingKey.type, 'public');
  assert.equal(settings.verifyingKey.export({ type: 'spki', format: 'pem' }).toString(), ed25519.publicKey.export({ type: 'spki', format: 'pem' }).toString());
  assert.equal(settings.controlPlaneInternalUrl, 'http://thermus-control-plane:8080');
  assert.equal(loadGatewaySettings({ ...valid, CONTROL_PLANE_INTERNAL_URL: 'http://thermus-spike-control:8080/' }).controlPlaneInternalUrl, 'http://thermus-spike-control:8080');
  assert.equal(loadGatewaySettings({ ...valid, GATEWAY_SIGNING_KEY: `\n${signingKeyPem}\n` }).signingKey.asymmetricKeyType, 'ed25519');
});

for (const name of ['GATEWAY_SIGNING_KEY', 'CONTROL_PLANE_INTERNAL_URL']) {
  test(`Given no ${name} or an empty value, when the gateway settings are loaded, then the start stops with a message that names it`, () => {
    refusal({ ...valid, [name]: undefined }, `${name} is required when MCP_TENANTS_ENABLED is true.`);
    refusal({ ...valid, [name]: '' }, `${name} is required when MCP_TENANTS_ENABLED is true.`);
  });
}

const refusedKeys: ReadonlyArray<readonly [string, string]> = [
  ['text that is not a key', 'not-a-private-key'],
  ['the public key of the pair', ed25519.publicKey.export({ type: 'spki', format: 'pem' }).toString()],
  ['an RSA private key', generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()],
  ['an EC private key', generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()],
  ['a broken PEM block', '-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----'],
  ['two private keys', `${signingKeyPem}${signingKeyPem}`],
];

for (const [label, value] of refusedKeys) {
  test(`Given ${label} in GATEWAY_SIGNING_KEY, when the gateway settings are loaded, then the start stops with the rule of the setting and without the value`, () => {
    refusal({ ...valid, GATEWAY_SIGNING_KEY: value }, keyRule);
  });
}

for (const value of ['http://thermus-control-plane:8080/internal', 'http://operator:secret@thermus-control-plane:8080', 'http://thermus-control-plane:8080?x=1', 'ftp://thermus-control-plane:8080', 'thermus-control-plane:8080', 'http://thermus-control-plane:8080#part']) {
  test(`Given CONTROL_PLANE_INTERNAL_URL ${JSON.stringify(value)}, when the gateway settings are loaded, then the start stops with the rule of the setting`, () => {
    refusal({ ...valid, CONTROL_PLANE_INTERNAL_URL: value }, urlRule);
  });
}

// The start compares the keys, not the text: a list with other line ends or spaces around a key still holds it.
for (const [label, list] of [
  ['only that key', publicKeyPem],
  ['that key after another key of a rotation', `${otherPublicKeyPem},${publicKeyPem}`],
  ['that key before another key of a rotation', `${publicKeyPem}, ${otherPublicKeyPem}`],
  ['that key with other line ends', ` ${publicKeyPem.replaceAll('\n', '\r\n')} `],
] as const) {
  test(`Given GATEWAY_PUBLIC_KEY with ${label}, when the start compares it with the public key of GATEWAY_SIGNING_KEY, then the start goes on`, () => {
    assert.doesNotThrow(() => { requireSigningKeyIn(loadGatewaySettings(valid), list); });
  });
}

for (const [label, list] of [
  ['only another key', otherPublicKeyPem],
  ['two other keys', `${otherPublicKeyPem},${generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' }).toString()}`],
  ['no key', ''],
] as const) {
  test(`Given GATEWAY_PUBLIC_KEY with ${label}, when the start compares it with the public key of GATEWAY_SIGNING_KEY, then the start stops with the rule that names both settings and no key`, () => {
    assert.throws(() => { requireSigningKeyIn(loadGatewaySettings(valid), list); }, (error: unknown) => {
      assert.ok(error instanceof DeploymentConfigError);
      assert.equal(error.message, listedKeyRule);
      return true;
    });
  });
}
