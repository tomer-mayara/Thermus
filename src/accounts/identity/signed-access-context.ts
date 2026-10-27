import { createHash, timingSafeEqual, type KeyObject } from 'node:crypto';
import { errors, jwtVerify, SignJWT, type JWTPayload } from 'jose';
import type { RoleGrant } from './access-context.ts';

// The request header that carries the signed access context from the gateway of the control plane to a tenant.
export const ACCESS_CONTEXT_HEADER = 'Thermus-Access';
// A context is valid for 2 minutes after the control plane signs it.
export const ACCESS_CONTEXT_LIFETIME_SECONDS = 120;

const CONTEXT_TYPE = 'thermus-access+jwt';
const ALGORITHM = 'EdDSA';
// The clocks of the control plane and its tenants differ by far less than this tolerance.
const CLOCK_TOLERANCE_SECONDS = 5;
const MAX_CONTEXT_CHARACTERS = 8_192;
const REQUIRED_CLAIMS = ['iss', 'sub', 'aud', 'iat', 'exp', 'grants', 'tokenHash'];

/** The access that the control plane resolved for one request: the user, its organization, and its current grants. */
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

type TypedClaims = { readonly context: VerifiedAccessContext; readonly tokenHash: string };

/** The tokenHash claim: the SHA-256 of the bearer token, in base64url. */
export function accessTokenHash(bearerToken: string): string {
  return createHash('sha256').update(bearerToken).digest('base64url');
}

/** Only the control plane holds the private key, so only the control plane can make a context. */
export class AccessContextSigner {
  readonly #key: KeyObject;

  constructor(privateKey: KeyObject) {
    this.#key = requireEd25519(privateKey, 'private');
  }

  /** The context of one request: it names the bearer token of that request through its hash. */
  sign(claims: AccessContextClaims, bearerToken: string, now = new Date()): Promise<string> {
    const issuedAt = Math.floor(now.getTime() / 1_000);
    const grants = claims.grants.map(({ role, permissions }) => ({ role, permissions: [...permissions] }));
    return new SignJWT({ grants, tokenHash: accessTokenHash(bearerToken), ...(claims.name === undefined ? {} : { name: claims.name }) })
      .setProtectedHeader({ alg: ALGORITHM, typ: CONTEXT_TYPE })
      .setIssuer(claims.authority)
      .setSubject(claims.subject)
      .setAudience(claims.organizationId)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + ACCESS_CONTEXT_LIFETIME_SECONDS)
      .sign(this.#key);
  }
}

/** A tenant holds only public keys: it can check a context, never make one. It tries each key, for a key rotation. */
export class AccessContextVerifier {
  readonly #keys: readonly KeyObject[];
  readonly #organizationId: string;

  constructor(options: { readonly publicKeys: readonly KeyObject[]; readonly organizationId: string }) {
    if (options.publicKeys.length === 0) throw new TypeError('An access context verifier needs at least one public key.');
    this.#keys = Object.freeze(options.publicKeys.map((key) => requireEd25519(key, 'public')));
    this.#organizationId = options.organizationId;
  }

  /** Accepts a context only with a valid signature, the pinned organization, the hash of the bearer token, and time left. */
  async verify(context: string | null | undefined, bearerToken: string | undefined): Promise<AccessContextVerification> {
    if (context === null || context === undefined || context === '') return refused('missing');
    if (context.length > MAX_CONTEXT_CHARACTERS) return refused('malformed');
    const payload = await this.#signedPayload(context);
    if (typeof payload === 'string') return refused(payload);
    const claims = typedClaimsOf(payload);
    if (claims === undefined) return refused('malformed');
    if (!sameTokenHash(claims.tokenHash, bearerToken)) return refused('token');
    return { status: 'verified', context: claims.context };
  }

  async #signedPayload(context: string): Promise<JWTPayload | AccessContextRefusal> {
    for (const key of this.#keys) {
      try {
        const { payload } = await jwtVerify(context, key, {
          algorithms: [ALGORITHM],
          typ: CONTEXT_TYPE,
          audience: this.#organizationId,
          requiredClaims: REQUIRED_CLAIMS,
          maxTokenAge: ACCESS_CONTEXT_LIFETIME_SECONDS,
          clockTolerance: CLOCK_TOLERANCE_SECONDS,
        });
        return payload;
      } catch (error) {
        if (!(error instanceof errors.JWSSignatureVerificationFailed)) return refusalOf(error);
      }
    }
    return 'signature';
  }
}

function refused(reason: AccessContextRefusal): AccessContextVerification {
  return { status: 'refused', reason };
}

// A fault of the context gives its reason. Each other failure is unexpected and escapes.
function refusalOf(error: unknown): AccessContextRefusal {
  if (error instanceof errors.JWTExpired) return 'expired';
  if (error instanceof errors.JWTClaimValidationFailed && error.claim === 'aud') return 'organization';
  if (error instanceof errors.JOSEError) return 'malformed';
  throw error;
}

function typedClaimsOf(payload: JWTPayload): TypedClaims | undefined {
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

function isGrantList(value: unknown): value is RoleGrant[] {
  return Array.isArray(value) && value.every((grant: unknown) => {
    if (typeof grant !== 'object' || grant === null) return false;
    const { role, permissions } = grant as Partial<Record<keyof RoleGrant, unknown>>;
    return isText(role) && Array.isArray(permissions) && permissions.every(isText);
  });
}

function sameTokenHash(claim: string, bearerToken: string | undefined): boolean {
  if (bearerToken === undefined) return false;
  const expected = Buffer.from(accessTokenHash(bearerToken));
  const actual = Buffer.from(claim);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function requireEd25519(key: KeyObject, type: 'private' | 'public'): KeyObject {
  if (key.type !== type || key.asymmetricKeyType !== 'ed25519') throw new TypeError(`An access context needs an Ed25519 ${type} key.`);
  return key;
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}
