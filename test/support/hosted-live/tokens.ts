import assert from 'node:assert/strict';
import { createLocalJWKSet, decodeJwt, decodeProtectedHeader, type JSONWebKeySet, type JWTPayload } from 'jose';
import { requestTimeout } from './settings.ts';

export interface TokenView {
  readonly alg: string | undefined;
  readonly kid: string | undefined;
  readonly claims: JWTPayload;
  readonly lifetime: number | undefined;
}

const recordedClaims = ['iss', 'aud', 'sub', 'sid', 'client_id', 'org_id', 'role', 'roles', 'permissions', 'scope'];

export function readToken(token: string): TokenView {
  const { alg, kid } = decodeProtectedHeader(token);
  const claims = decodeJwt(token);
  const lifetime = claims.exp === undefined || claims.iat === undefined ? undefined : claims.exp - claims.iat;
  return { alg, kid, claims, lifetime };
}

export function tokenRecord(token: TokenView): string {
  const claims = recordedClaims.filter((name) => token.claims[name] !== undefined).map((name) => [name, token.claims[name]]);
  return JSON.stringify({ alg: token.alg, kid: token.kid, ...Object.fromEntries(claims), 'exp-iat': token.lifetime });
}

export function secondsLeft(token: TokenView): number {
  return (token.claims.exp ?? 0) - Math.floor(Date.now() / 1000);
}

export function sortedClaimList(token: TokenView, name: string): string[] {
  const value = token.claims[name];
  assert.ok(Array.isArray(value), `The token has no ${name} list: ${JSON.stringify(value)}.`);
  return value.map(String).toSorted();
}

export async function signingKeyIds(url: string): Promise<string[]> {
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(requestTimeout) });
  assert.equal(response.status, 200, `GET ${url} gave HTTP ${response.status}.`);
  const { keys } = createLocalJWKSet((await response.json()) as JSONWebKeySet).jwks();
  return keys.filter(({ use }) => use === undefined || use === 'sig').map(({ kid }) => String(kid));
}

export function errorCode(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const { code, claim } = error as Error & { code?: unknown; claim?: unknown };
  return [error.name, code, claim].filter((part) => part !== undefined).join(' ');
}
