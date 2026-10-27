import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { describe, test } from 'node:test';
import { AccessContextSigner } from '../../../src/accounts/identity/access-context-signer.ts';
import { AccessContextVerifier } from '../../../src/accounts/identity/access-context-verifier.ts';
import type { AccessContextClaims } from '../../../src/accounts/identity/signed-access-context.ts';

const organizationId = 'org_01PINNED';
const token = 'connect-token-of-the-request';
const access: AccessContextClaims = {
  authority: 'workos:client_01CONTROL',
  subject: 'user_01READER',
  name: 'Ann Reader',
  organizationId,
  grants: [{ role: 'user', permissions: ['product:access'] }],
};
const gateway = generateKeyPairSync('ed25519');
const otherGateway = generateKeyPairSync('ed25519');
const signer = new AccessContextSigner(gateway.privateKey);
// The verify side of a tenant gets only public keys.
const verifier = new AccessContextVerifier({ publicKeys: [gateway.publicKey], organizationId });

function changedBody(context: string): string {
  const [header, body, signature] = context.split('.');
  const claims = JSON.parse(Buffer.from(body ?? '', 'base64url').toString('utf8'));
  const changed = Buffer.from(JSON.stringify({ ...claims, grants: [{ role: 'admin', permissions: ['product:access', 'billing:manage'] }] })).toString('base64url');
  return [header, changed, signature].join('.');
}

describe('Signed access context', () => {
  test('Given a context that the private key signs, when a tenant verifies it with the public key and the same bearer token, then it gives the user, the organization, the grants, and an expiry 2 minutes after the signature', async () => {
    const signedAt = new Date();
    const context = await signer.sign(access, token, signedAt);

    const verification = await verifier.verify(context, token);

    assert.equal(verification.status, 'verified');
    assert.ok(verification.status === 'verified');
    assert.deepEqual(verification.context, { ...access, expiresAtUnixSeconds: Math.floor(signedAt.getTime() / 1_000) + 120 });
    assert.ok(Object.isFrozen(verification.context) && Object.isFrozen(verification.context.grants));
  });

  test('Given a context without a name, when a tenant verifies it, then the context has no name', async () => {
    const { name: _name, ...unnamed } = access;

    const verification = await verifier.verify(await signer.sign(unnamed, token), token);

    assert.ok(verification.status === 'verified');
    assert.equal('name' in verification.context, false);
  });

  const refusals: ReadonlyArray<[string, () => Promise<[string | null, string | undefined]>, string]> = [
    ['a changed body', async () => [changedBody(await signer.sign(access, token)), token], 'signature'],
    ['the signature of another key pair', async () => [await new AccessContextSigner(otherGateway.privateKey).sign(access, token), token], 'signature'],
    ['an expired context', async () => [await signer.sign(access, token, new Date(Date.now() - 180_000)), token], 'expired'],
    ['a context for another organization', async () => [await signer.sign({ ...access, organizationId: 'org_01OTHER' }, token), token], 'organization'],
    ['another bearer token', async () => [await signer.sign(access, token), 'connect-token-of-another-request'], 'token'],
    ['no bearer token', async () => [await signer.sign(access, token), undefined], 'token'],
    ['no context', async () => [null, token], 'missing'],
    ['an empty context', async () => ['', token], 'missing'],
    ['a value that is not a JWT', async () => ['not.a.context', token], 'malformed'],
    ['a context longer than 8 KiB', async () => [`${await signer.sign(access, token)}${'A'.repeat(8_192)}`, token], 'malformed'],
  ];
  for (const [label, input, reason] of refusals) {
    test(`Given ${label}, when a tenant verifies the context, then it refuses the context with the reason ${reason}`, async () => {
      const [context, bearerToken] = await input();

      assert.deepEqual(await verifier.verify(context, bearerToken), { status: 'refused', reason });
    });
  }

  test('Given several public keys, when a context of any of them arrives, then the tenant tries each key and verifies it', async () => {
    const rotation = new AccessContextVerifier({ publicKeys: [otherGateway.publicKey, gateway.publicKey], organizationId });

    assert.equal((await rotation.verify(await signer.sign(access, token), token)).status, 'verified');
    assert.equal((await rotation.verify(await new AccessContextSigner(otherGateway.privateKey).sign(access, token), token)).status, 'verified');
    assert.deepEqual(await rotation.verify(await new AccessContextSigner(generateKeyPairSync('ed25519').privateKey).sign(access, token), token), { status: 'refused', reason: 'signature' });
  });

  test('Given a grant that is not a role with permission names, when the control plane signs it, then a tenant refuses the context as malformed', async () => {
    const context = await signer.sign({ ...access, grants: [{ role: 'user', permissions: [7] }] } as unknown as AccessContextClaims, token);

    assert.deepEqual(await verifier.verify(context, token), { status: 'refused', reason: 'malformed' });
  });

  test('Given a key of the wrong kind, when a signer or a verifier is made, then it refuses the key: the signer needs an Ed25519 private key and the verifier Ed25519 public keys', () => {
    const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });

    assert.throws(() => new AccessContextSigner(gateway.publicKey), TypeError);
    assert.throws(() => new AccessContextSigner(rsa.privateKey), TypeError);
    assert.throws(() => new AccessContextVerifier({ publicKeys: [gateway.privateKey], organizationId }), TypeError);
    assert.throws(() => new AccessContextVerifier({ publicKeys: [rsa.publicKey], organizationId }), TypeError);
    assert.throws(() => new AccessContextVerifier({ publicKeys: [], organizationId }), TypeError);
  });
});
