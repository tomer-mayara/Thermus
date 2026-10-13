import { generateKeyPairSync, sign, type JsonWebKey, type KeyObject } from 'node:crypto';

export const localIssuer = 'http://localhost:8080/api/auth';
export const mcpResourceUrl = 'http://localhost:8080/mcp';

export type TokenFields = Readonly<Record<string, unknown>>;

export type SigningAlgorithm = 'EdDSA' | 'ES256';

export interface PublicSigningKey extends JsonWebKey {
  readonly kid: string;
  readonly alg: SigningAlgorithm;
}

// Signs JWTs as the provider's jwt() plugin does, with Ed25519 by default, so each test runs the real verification path.
export class AccessTokenSigner {
  readonly publicKey: PublicSigningKey;
  private readonly privateKey: KeyObject;

  constructor(kid: string, algorithm: SigningAlgorithm = 'EdDSA') {
    const { privateKey, publicKey } = algorithm === 'EdDSA'
      ? generateKeyPairSync('ed25519')
      : generateKeyPairSync('ec', { namedCurve: 'P-256' });
    this.privateKey = privateKey;
    this.publicKey = { ...publicKey.export({ format: 'jwk' }), kid, alg: algorithm };
  }

  // A JWS has the raw form of an ECDSA signature, not DER. Ed25519 ignores the encoding.
  sign(claims: TokenFields, header: TokenFields = {}): string {
    const { alg, kid } = this.publicKey;
    const signed = `${encoded({ alg, typ: 'at+jwt', kid, ...header })}.${encoded(claims)}`;
    const signature = sign(alg === 'EdDSA' ? null : 'sha256', Buffer.from(signed), { key: this.privateKey, dsaEncoding: 'ieee-p1363' });
    return `${signed}.${signature.toString('base64url')}`;
  }
}

// The claims of a user token from the authorization code grant. A change with the value undefined removes the claim.
export function localUserClaims(changes: TokenFields = {}): TokenFields {
  const issuedAt = Math.floor(Date.now() / 1_000);
  return {
    iss: localIssuer,
    sub: 'user-1',
    aud: [mcpResourceUrl, `${localIssuer}/oauth2/userinfo`],
    azp: 'native-client',
    client_id: 'native-client',
    scope: 'openid profile',
    sid: 'session-1',
    iat: issuedAt,
    exp: issuedAt + 3_600,
    jti: 'token-1',
    ...changes,
  };
}

// Keeps the original signature, as an attacker who changes the claims of a token must do.
export function withChangedClaims(token: string, changes: TokenFields): string {
  const [header = '', payload = '', signature = ''] = token.split('.');
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as TokenFields;
  return [header, encoded({ ...claims, ...changes }), signature].join('.');
}

function encoded(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}
