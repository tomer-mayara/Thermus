import { timingSafeEqual } from 'node:crypto';
import type { JWTPayload } from 'jose';
import type { RoleGrant } from './access-context.ts';
import { accessTokenHash, type VerifiedAccessContext } from './signed-access-context.ts';

/** The claims of a context with a valid signature, in their record form. */
export interface TypedAccessClaims {
  readonly context: VerifiedAccessContext;
  readonly tokenHash: string;
}

/**
 * The typed claims of a signed payload, or undefined when a claim has another type. The control plane signs only
 * valid claims, so another type means a fault of the gateway: the tenant refuses the context.
 */
export function typedAccessClaimsOf(payload: JWTPayload): TypedAccessClaims | undefined {
  const { iss, sub, aud, exp, grants, name, tokenHash } = payload;
  if (!isText(iss) || !isText(sub) || !isText(aud) || typeof exp !== 'number' || !isText(tokenHash)) return undefined;
  if (!isGrantList(grants) || (name !== undefined && typeof name !== 'string')) return undefined;
  const context: VerifiedAccessContext = {
    authority: iss,
    subject: sub,
    ...(name === undefined ? {} : { name }),
    organizationId: aud,
    grants: Object.freeze(grants.map((grant) => Object.freeze({ role: grant.role, permissions: Object.freeze([...grant.permissions]) }))),
    expiresAtUnixSeconds: exp,
  };
  return { context: Object.freeze(context), tokenHash };
}

/**
 * True when the tokenHash claim is the hash of the bearer token of the request. The comparison takes the same time
 * for each hash of the same length.
 */
export function namesBearerToken(tokenHash: string, bearerToken: string | undefined): boolean {
  if (bearerToken === undefined) return false;
  const expected = Buffer.from(accessTokenHash(bearerToken));
  const actual = Buffer.from(tokenHash);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// Each grant is a role with the names of its permissions, as the control plane read them. The copy above drops each
// other field of a grant.
function isGrantList(value: unknown): value is RoleGrant[] {
  return Array.isArray(value) && value.every((grant: unknown) => {
    if (typeof grant !== 'object' || grant === null) return false;
    const { role, permissions } = grant as Partial<Record<keyof RoleGrant, unknown>>;
    return isText(role) && Array.isArray(permissions) && permissions.every(isText);
  });
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}
