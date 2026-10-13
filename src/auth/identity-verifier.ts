import type { AuthenticatedUser } from './access-context.ts';

export interface VerifiedIdentity {
  readonly user: AuthenticatedUser;
  readonly issuer: string;
  readonly clientId: string;
  readonly scopes: readonly string[];
  readonly issuedAtUnixSeconds: number;
  readonly expiresAtUnixSeconds: number;
  readonly resource: URL;
}

export interface IdentityVerifier {
  verifyAccessToken(token: string): Promise<VerifiedIdentity>;
}

export class InvalidAccessTokenError extends Error {}
