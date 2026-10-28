import type { KeyObject } from 'node:crypto';
import { namesBearerToken, typedAccessClaimsOf } from './access-context-claims.ts';
import { signedPayloadOf, type ContextTrust } from './access-context-signature.ts';
import { requireEd25519Key, type AccessContextVerification } from './signed-access-context.ts';

// A tenant relays an event up to 30 seconds after its tool call ends (the age bound of the audit collector), so the
// context of the call can expire while the event waits (SO-05).
const RELAY_GRACE_SECONDS = 30;

/**
 * A tenant holds only public keys: it can check a context, never make one. It tries each key, for a key rotation. The
 * control plane uses the public key of its own signing key for the audit relays of an organization.
 */
export class AccessContextVerifier {
  readonly #trust: ContextTrust;

  constructor(options: { readonly publicKeys: readonly KeyObject[]; readonly organizationId: string }) {
    if (options.publicKeys.length === 0) throw new TypeError('An access context verifier needs at least one public key.');
    this.#trust = Object.freeze({ keys: Object.freeze(options.publicKeys.map((key) => requireEd25519Key(key, 'public'))), organizationId: options.organizationId });
  }

  /**
   * Accepts a context only with a valid signature, the pinned organization, the hash of the bearer token of the
   * request, and time left. Each refusal gives its reason; the context itself never reaches a message.
   */
  async verify(context: string | null | undefined, bearerToken: string | undefined): Promise<AccessContextVerification> {
    const payload = await signedPayloadOf(context ?? '', this.#trust);
    if (typeof payload === 'string') return { status: 'refused', reason: payload };
    const claims = typedAccessClaimsOf(payload);
    if (claims === undefined) return { status: 'refused', reason: 'malformed' };
    if (!namesBearerToken(claims.tokenHash, bearerToken)) return { status: 'refused', reason: 'token' };
    return { status: 'verified', context: claims.context };
  }

  /**
   * Accepts the context of an audit relay: the checks of verify() without the bearer token, which a relay does not
   * carry, and with 30 seconds of grace after the expiry.
   */
  async verifyRelay(context: string | null | undefined): Promise<AccessContextVerification> {
    const payload = await signedPayloadOf(context ?? '', this.#trust, RELAY_GRACE_SECONDS);
    if (typeof payload === 'string') return { status: 'refused', reason: payload };
    const claims = typedAccessClaimsOf(payload);
    return claims === undefined ? { status: 'refused', reason: 'malformed' } : { status: 'verified', context: claims.context };
  }
}
