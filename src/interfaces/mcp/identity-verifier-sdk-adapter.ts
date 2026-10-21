import {
  OAuthError,
  OAuthErrorCode,
  type AuthInfo,
  type OAuthTokenVerifier,
} from '@modelcontextprotocol/server';
import type { AuthenticatedUser } from '../../accounts/identity/access-context.ts';
import { InvalidAccessTokenError, type IdentityVerifier, type VerifiedIdentity } from '../../accounts/identity/identity-verifier.ts';

type VerifiedClaims = {
  readonly user: AuthenticatedUser;
  readonly issuer: string;
  readonly clientId: string;
  readonly scopes: readonly string[];
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly audience: string;
};

export class IdentityVerifierSdkAdapter implements OAuthTokenVerifier {
  private readonly verifier: IdentityVerifier;
  private readonly reportUnexpectedFailure: (cause: unknown) => void;

  constructor(verifier: IdentityVerifier, reportUnexpectedFailure: (cause: unknown) => void) {
    this.verifier = verifier;
    this.reportUnexpectedFailure = reportUnexpectedFailure;
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const identity = await this.verifiedIdentity(token);
    if (!establishesHumanUser(identity)) throw invalidToken();
    return {
      token,
      clientId: identity.clientId,
      scopes: [...identity.scopes],
      expiresAt: identity.expiresAtUnixSeconds,
      resource: new URL(identity.resource.href),
      extra: verifiedClaims(identity),
    };
  }

  private async verifiedIdentity(token: string): Promise<VerifiedIdentity> {
    try {
      return await this.verifier.verifyAccessToken(token);
    } catch (error) {
      if (error instanceof InvalidAccessTokenError) throw invalidToken();
      this.reportUnexpectedFailure(error);
      throw error;
    }
  }
}

export function verifiedUserOf(authInfo: AuthInfo): AuthenticatedUser {
  const user = authInfo.extra?.user;
  if (!isUsableUser(user)) throw new Error('AuthInfo has no verified user');
  return user;
}

function invalidToken(): OAuthError {
  return new OAuthError(OAuthErrorCode.InvalidToken, 'Invalid access token');
}

function establishesHumanUser(identity: VerifiedIdentity): boolean {
  return isUsableUser(identity.user)
    && isText(identity.issuer)
    && isText(identity.clientId)
    && identity.clientId !== identity.user.subject
    && Number.isFinite(identity.issuedAtUnixSeconds)
    && Number.isFinite(identity.expiresAtUnixSeconds)
    && identity.resource instanceof URL
    && Array.isArray(identity.scopes);
}

function isUsableUser(value: unknown): value is AuthenticatedUser {
  if (typeof value !== 'object' || value === null) return false;
  const { authority, subject, selectedOrganizationId } = value as Partial<Record<keyof AuthenticatedUser, unknown>>;
  return isText(authority) && isText(subject) && (selectedOrganizationId === undefined || isText(selectedOrganizationId));
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}

function verifiedClaims(identity: VerifiedIdentity): VerifiedClaims {
  const { authority, subject, selectedOrganizationId } = identity.user;
  return Object.freeze({
    user: Object.freeze({ authority, subject, ...(selectedOrganizationId === undefined ? {} : { selectedOrganizationId }) }),
    issuer: identity.issuer,
    clientId: identity.clientId,
    scopes: Object.freeze([...identity.scopes]),
    issuedAt: identity.issuedAtUnixSeconds,
    expiresAt: identity.expiresAtUnixSeconds,
    audience: identity.resource.href,
  });
}
