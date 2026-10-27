import { createPublicKey, type KeyObject } from 'node:crypto';

// Exactly one PEM block with the public key label. A private key never passes, also when Node can derive its public
// key from it: a tenant must not hold the signing key of the gateway.
const PEM_PUBLIC_KEY = /^-----BEGIN PUBLIC KEY-----[A-Za-z0-9+/=\s]+-----END PUBLIC KEY-----$/;

/** The keys of a list of PEM public keys separated by commas, or undefined when a part is not an Ed25519 public key. */
export function ed25519PublicKeysOf(list: string): readonly KeyObject[] | undefined {
  const keys = list.split(',').map((part) => ed25519PublicKeyOf(part.trim()));
  return keys.every((key) => key !== undefined) ? Object.freeze(keys) : undefined;
}

function ed25519PublicKeyOf(pem: string): KeyObject | undefined {
  if (!PEM_PUBLIC_KEY.test(pem)) return undefined;
  try {
    const key = createPublicKey({ key: pem, format: 'pem' });
    return key.asymmetricKeyType === 'ed25519' ? key : undefined;
  } catch {
    // A refused key gives no detail: the message of the start names the setting only.
    return undefined;
  }
}
