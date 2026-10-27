import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { describe, test } from 'node:test';
import { SignJWT } from 'jose';
import { AccessContextSigner } from '../../../src/accounts/identity/access-context-signer.ts';
import { AccessContextVerifier } from '../../../src/accounts/identity/access-context-verifier.ts';
import { ACCESS_CONTEXT_HEADER, ACCESS_CONTEXT_LIFETIME_SECONDS } from '../../../src/accounts/identity/signed-access-context.ts';

// The header contract of docs/design/authentication-design.md, "Signed access context": the gateway of the control
// plane (SO-05) writes it, and a tenant reads it.

const organizationId = 'org_01CONTRACT';
const token = 'connect-token-of-the-forwarded-request';
const access = {
  authority: 'workos:client_01CONTROL',
  subject: 'user_01CONTRACT',
  name: 'Contract Reader',
  organizationId,
  grants: [{ role: 'user', permissions: ['product:access'] }],
};
const keys = generateKeyPairSync('ed25519');

function partOf(context: string, index: 0 | 1): Record<string, unknown> {
  return JSON.parse(Buffer.from(context.split('.')[index] ?? '', 'base64url').toString('utf8')) as Record<string, unknown>;
}

describe('Signed access context header contract', () => {
  test('Given the contract, when a request carries a context, then it carries it in the header Thermus-Access, valid for 120 seconds', () => {
    assert.equal(ACCESS_CONTEXT_HEADER, 'Thermus-Access');
    assert.equal(ACCESS_CONTEXT_LIFETIME_SECONDS, 120);
  });

  test('Given a context of the control plane, when a reader decodes it, then it is a compact JWS in base64url with the header alg EdDSA and typ thermus-access+jwt and exactly the documented claims, with the times in whole seconds', async () => {
    const signedAt = new Date('2026-10-27T12:00:00.000Z');

    const context = await new AccessContextSigner(keys.privateKey).sign(access, token, signedAt);

    const parts = context.split('.');
    assert.equal(parts.length, 3);
    for (const part of parts) assert.match(part, /^[A-Za-z0-9_-]+$/);
    assert.deepEqual(partOf(context, 0), { alg: 'EdDSA', typ: 'thermus-access+jwt' });
    assert.deepEqual(partOf(context, 1), {
      iss: 'workos:client_01CONTROL',
      sub: 'user_01CONTRACT',
      aud: organizationId,
      iat: 1_793_102_400,
      exp: 1_793_102_520,
      grants: [{ role: 'user', permissions: ['product:access'] }],
      tokenHash: createHash('sha256').update(token).digest('base64url'),
      name: 'Contract Reader',
    });
    assert.match(String(partOf(context, 1).tokenHash), /^[A-Za-z0-9_-]{43}$/);
  });

  test('Given a context that another writer makes from the documented contract, when a tenant reads it, then the tenant verifies it with the public key', async () => {
    const now = Math.floor(Date.now() / 1_000);
    const context = await new SignJWT({ grants: access.grants, tokenHash: createHash('sha256').update(token).digest('base64url') })
      .setProtectedHeader({ alg: 'EdDSA', typ: 'thermus-access+jwt' })
      .setIssuer(access.authority).setSubject(access.subject).setAudience(organizationId)
      .setIssuedAt(now).setExpirationTime(now + 120)
      .sign(keys.privateKey);

    const verification = await new AccessContextVerifier({ publicKeys: [keys.publicKey], organizationId }).verify(context, token);

    assert.equal(verification.status, 'verified');
  });

  test('Given a writer that gives exp in milliseconds, when a tenant reads its context 3 minutes after iat, then the tenant refuses it as expired: the reader bounds the lifetime from iat too', async () => {
    const issuedAt = Math.floor(Date.now() / 1_000) - 180;
    const context = await new SignJWT({ grants: access.grants, tokenHash: createHash('sha256').update(token).digest('base64url') })
      .setProtectedHeader({ alg: 'EdDSA', typ: 'thermus-access+jwt' })
      .setIssuer(access.authority).setSubject(access.subject).setAudience(organizationId)
      .setIssuedAt(issuedAt).setExpirationTime((issuedAt + 120) * 1_000)
      .sign(keys.privateKey);

    const verification = await new AccessContextVerifier({ publicKeys: [keys.publicKey], organizationId }).verify(context, token);

    assert.deepEqual(verification, { status: 'refused', reason: 'expired' });
  });

  test('Given a context of another type or algorithm, when a tenant reads it, then it refuses the context', async () => {
    const now = Math.floor(Date.now() / 1_000);
    const claims = { grants: access.grants, tokenHash: createHash('sha256').update(token).digest('base64url') };
    const untyped = await new SignJWT(claims).setProtectedHeader({ alg: 'EdDSA', typ: 'JWT' })
      .setIssuer(access.authority).setSubject(access.subject).setAudience(organizationId).setIssuedAt(now).setExpirationTime(now + 120).sign(keys.privateKey);
    const shared = await new SignJWT(claims).setProtectedHeader({ alg: 'HS256', typ: 'thermus-access+jwt' })
      .setIssuer(access.authority).setSubject(access.subject).setAudience(organizationId).setIssuedAt(now).setExpirationTime(now + 120)
      .sign(new TextEncoder().encode('a-shared-secret-that-an-attacker-chose-0123'));
    const verifier = new AccessContextVerifier({ publicKeys: [keys.publicKey], organizationId });

    assert.deepEqual(await verifier.verify(untyped, token), { status: 'refused', reason: 'malformed' });
    assert.deepEqual(await verifier.verify(shared, token), { status: 'refused', reason: 'malformed' });
  });
});
