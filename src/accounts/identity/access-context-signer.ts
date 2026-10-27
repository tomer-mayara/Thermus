import type { KeyObject } from 'node:crypto';
import { SignJWT } from 'jose';
import {
  ACCESS_CONTEXT_ALGORITHM,
  ACCESS_CONTEXT_LIFETIME_SECONDS,
  ACCESS_CONTEXT_TYPE,
  accessTokenHash,
  requireEd25519Key,
  type AccessContextClaims,
} from './signed-access-context.ts';

/** Only the control plane holds the private key, so only the control plane can make a context. */
export class AccessContextSigner {
  readonly #key: KeyObject;

  constructor(privateKey: KeyObject) {
    this.#key = requireEd25519Key(privateKey, 'private');
  }

  /** The context of one request: it names the bearer token of that request through its hash. */
  sign(claims: AccessContextClaims, bearerToken: string, now = new Date()): Promise<string> {
    const issuedAt = Math.floor(now.getTime() / 1_000);
    const grants = claims.grants.map(({ role, permissions }) => ({ role, permissions: [...permissions] }));
    return new SignJWT({ grants, tokenHash: accessTokenHash(bearerToken), ...(claims.name === undefined ? {} : { name: claims.name }) })
      .setProtectedHeader({ alg: ACCESS_CONTEXT_ALGORITHM, typ: ACCESS_CONTEXT_TYPE })
      .setIssuer(claims.authority)
      .setSubject(claims.subject)
      .setAudience(claims.organizationId)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + ACCESS_CONTEXT_LIFETIME_SECONDS)
      .sign(this.#key);
  }
}
