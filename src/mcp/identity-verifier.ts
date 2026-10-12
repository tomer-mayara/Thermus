export interface VerifiedIdentity {
  clientId: string;
  scopes: readonly string[];
  expiresAtUnixSeconds?: number;
  resource?: URL;
}

export interface IdentityVerifier {
  verifyAccessToken(token: string): Promise<VerifiedIdentity>;
}

export class InvalidAccessTokenError extends Error {}
