import type { KeyObject } from 'node:crypto';
import { errors, jwtVerify, type JWTPayload } from 'jose';
import { ACCESS_CONTEXT_ALGORITHM, ACCESS_CONTEXT_LIFETIME_SECONDS, ACCESS_CONTEXT_TYPE, type AccessContextRefusal } from './signed-access-context.ts';

// An untrusted header bounds the work of the check before any parse.
const MAX_CONTEXT_CHARACTERS = 8_192;
// The clocks of the control plane and its tenants differ by far less than the tolerance of 5 seconds.
const CHECKS = {
  algorithms: [ACCESS_CONTEXT_ALGORITHM],
  typ: ACCESS_CONTEXT_TYPE,
  requiredClaims: ['iss', 'sub', 'aud', 'iat', 'exp', 'grants', 'tokenHash'],
  maxTokenAge: ACCESS_CONTEXT_LIFETIME_SECONDS,
  clockTolerance: 5,
};

/**
 * The payload of a context that one of the keys signed for the organization and that has not expired, or the reason
 * of the refusal. A key rotation lists several keys, so a signature that one key refuses goes to the next key.
 */
export async function signedPayloadOf(context: string, keys: readonly KeyObject[], organizationId: string): Promise<JWTPayload | AccessContextRefusal> {
  if (context === '') return 'missing';
  if (context.length > MAX_CONTEXT_CHARACTERS) return 'malformed';
  for (const key of keys) {
    try {
      return (await jwtVerify(context, key, { ...CHECKS, audience: organizationId })).payload;
    } catch (error) {
      if (!(error instanceof errors.JWSSignatureVerificationFailed)) return refusalOf(error);
    }
  }
  return 'signature';
}

// A fault of the context gives its reason. Each other failure is unexpected and escapes.
function refusalOf(error: unknown): AccessContextRefusal {
  if (error instanceof errors.JWTExpired) return 'expired';
  if (error instanceof errors.JWTClaimValidationFailed && error.claim === 'aud') return 'organization';
  if (error instanceof errors.JOSEError) return 'malformed';
  throw error;
}
