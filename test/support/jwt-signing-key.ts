import { exportJWK, generateKeyPair, SignJWT, type CryptoKey, type JWK, type JWTPayload } from 'jose';

export interface TokenSettings {
  readonly issuer: string;
  readonly audience?: string;
  readonly issuedAtUnixSeconds?: number;
  readonly expiresAtUnixSeconds?: number;
}

export function nowInSeconds(): number {
  return Math.floor(Date.now() / 1_000);
}

export class SigningKey {
  readonly kid: string;
  readonly publicJwk: JWK;
  readonly #privateKey: CryptoKey;

  private constructor(kid: string, privateKey: CryptoKey, publicJwk: JWK) {
    this.kid = kid;
    this.#privateKey = privateKey;
    this.publicJwk = publicJwk;
  }

  static async generate(kid: string): Promise<SigningKey> {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    return new SigningKey(kid, privateKey, { ...await exportJWK(publicKey), kid, alg: 'RS256', use: 'sig' });
  }

  async sign(claims: JWTPayload, settings: TokenSettings): Promise<string> {
    const issuedAt = settings.issuedAtUnixSeconds ?? nowInSeconds();
    const token = new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: this.kid })
      .setIssuer(settings.issuer)
      .setIssuedAt(issuedAt)
      .setExpirationTime(settings.expiresAtUnixSeconds ?? issuedAt + 3_600);
    if (settings.audience !== undefined) token.setAudience(settings.audience);
    return token.sign(this.#privateKey);
  }
}
