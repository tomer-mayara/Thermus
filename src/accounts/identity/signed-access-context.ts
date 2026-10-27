import { createHash, type KeyObject } from 'node:crypto';
import type { RoleGrant } from './access-context.ts';

// The contract of the signed access context: the gateway of the control plane writes it and a tenant reads it. The
// context is an EdDSA JWT of the type below in one request header.
export const ACCESS_CONTEXT_HEADER = 'Thermus-Access';
export const ACCESS_CONTEXT_TYPE = 'thermus-access+jwt';
export const ACCESS_CONTEXT_ALGORITHM = 'EdDSA';
// A context expires 2 minutes after the control plane signs it.
export const ACCESS_CONTEXT_LIFETIME_SECONDS = 120;

/**
 * The access that the control plane resolved for one request: the claims iss (authority), sub (subject), aud
 * (organization), grants, and the optional display name.
 */
export interface AccessContextClaims {
  readonly authority: string;
  readonly subject: string;
  /** Display metadata only; never an authority or authorization input. */
  readonly name?: string;
  readonly organizationId: string;
  readonly grants: readonly RoleGrant[];
}

export interface VerifiedAccessContext extends AccessContextClaims {
  readonly expiresAtUnixSeconds: number;
}

export type AccessContextRefusal = 'missing' | 'malformed' | 'signature' | 'organization' | 'expired' | 'token';

export type AccessContextVerification =
  | { readonly status: 'verified'; readonly context: VerifiedAccessContext }
  | { readonly status: 'refused'; readonly reason: AccessContextRefusal };

/** The tokenHash claim: the SHA-256 of the bearer token of the request, in base64url. */
export function accessTokenHash(bearerToken: string): string {
  return createHash('sha256').update(bearerToken).digest('base64url');
}

/** Only an Ed25519 key of the given type can sign (private) or verify (public) a context. */
export function requireEd25519Key(key: KeyObject, type: 'private' | 'public'): KeyObject {
  if (key.type !== type || key.asymmetricKeyType !== 'ed25519') throw new TypeError(`An access context needs an Ed25519 ${type} key.`);
  return key;
}
