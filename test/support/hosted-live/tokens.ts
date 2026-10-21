import { decodeJwt, decodeProtectedHeader, type JWTPayload } from 'jose';

export interface TokenView {
  readonly alg: string | undefined;
  readonly kid: string | undefined;
  readonly claims: JWTPayload;
  readonly lifetime: number | undefined;
}

export function readToken(token: string): TokenView {
  const { alg, kid } = decodeProtectedHeader(token);
  const claims = decodeJwt(token);
  const lifetime = claims.exp === undefined || claims.iat === undefined ? undefined : claims.exp - claims.iat;
  return { alg, kid, claims, lifetime };
}

export function secondsLeft(token: TokenView): number {
  return (token.claims.exp ?? 0) - Math.floor(Date.now() / 1000);
}
