import {
  OAuthError,
  OAuthErrorCode,
  type AuthInfo,
  type OAuthTokenVerifier,
} from '@modelcontextprotocol/server';
import { InvalidAccessTokenError, type IdentityVerifier } from './identity-verifier.ts';

export class IdentityVerifierSdkAdapter implements OAuthTokenVerifier {
  private readonly verifier: IdentityVerifier;

  constructor(verifier: IdentityVerifier) {
    this.verifier = verifier;
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    try {
      const identity = await this.verifier.verifyAccessToken(token);
      return {
        token,
        clientId: identity.clientId,
        scopes: [...identity.scopes],
        expiresAt: identity.expiresAtUnixSeconds,
        resource: identity.resource,
      };
    } catch (error) {
      if (error instanceof InvalidAccessTokenError) {
        throw new OAuthError(OAuthErrorCode.InvalidToken, 'Invalid access token');
      }
      throw error;
    }
  }
}
