import type { User } from '@workos-inc/node';

// The facts of a WorkOS session check, refresh, or code exchange that the browser session reads.
export interface SessionFacts {
  readonly user: Pick<User, 'id' | 'email' | 'firstName' | 'lastName'>;
  readonly organizationId?: string;
}

export type SealCheck = (SessionFacts & { readonly authenticated: true }) | { readonly authenticated: false; readonly reason: string };

export type SealRefresh =
  | (SessionFacts & { readonly authenticated: true; readonly sealedSession?: string })
  | { readonly authenticated: false; readonly reason: string; readonly retryable: boolean; readonly error?: unknown };

export interface CodeExchange extends Omit<SessionFacts, 'user'> {
  // Trusted facts from the code exchange, never from callback parameters or a decoded token.
  readonly user: SessionFacts['user'] & { readonly emailVerified?: boolean };
  readonly sealedSession?: string;
  readonly authenticationMethod?: string;
}

export interface StoredSession {
  readonly accessToken?: string;
}

// The CookieSession of the SDK.
export interface WorkOSSealedSession {
  authenticate(): Promise<SealCheck>;
  refresh(options?: { organizationId?: string }): Promise<SealRefresh>;
}

interface SealOptions {
  sessionData: string;
  cookiePassword: string;
}

// The part of the pinned WorkOS SDK client that the browser session calls.
export interface WorkOSSessionClient {
  readonly userManagement: {
    getAuthorizationUrlWithPKCE(options: { provider: 'authkit'; redirectUri: string; clientId: string }): Promise<{ url: string; state: string; codeVerifier: string }>;
    authenticateWithCode(payload: {
      clientId: string;
      code: string;
      codeVerifier: string;
      session: { sealSession: true; cookiePassword: string };
    }): Promise<CodeExchange>;
    loadSealedSession(options: SealOptions): WorkOSSealedSession;
    getSessionFromCookie(options: SealOptions): Promise<StoredSession | undefined>;
    getLogoutUrl(options: { sessionId: string }): string;
  };
}

export function sealedSessionOf(result: { readonly sealedSession?: string }): string {
  if (result.sealedSession === undefined || result.sealedSession === '') throw new Error('WorkOS gave no sealed session');
  return result.sealedSession;
}

// The SDK inlines its own copy of jose, so the error classes of the jose package do not match its errors. Thus the
// failures are told apart by their name, code, and status.
function fieldOf(error: unknown, field: 'name' | 'code' | 'status' | 'error'): unknown {
  return typeof error === 'object' && error !== null ? (error as Readonly<Record<string, unknown>>)[field] : undefined;
}

// The cached key set does not have the key of the token yet.
export function isNewSigningKey(error: unknown): boolean {
  return fieldOf(error, 'code') === 'ERR_JWKS_NO_MATCHING_KEY';
}

// The SDK throws these errors for a seal whose HMAC part is not base64url or whose expiration part is not a number. Such
// a seal can never open, so it means no session, not a server error.
export function isDamagedSeal(error: unknown): boolean {
  return fieldOf(error, 'name') === 'InvalidCharacterError' || (error instanceof Error && error.message === 'Invalid expiration');
}

// WorkOS refuses a code or an organization switch with a 4xx OAuth error. It is no outage.
export function isOAuthRefusal(error: unknown): boolean {
  const status = fieldOf(error, 'status');
  return fieldOf(error, 'name') === 'OauthException' && typeof status === 'number' && status >= 400 && status < 500;
}

export function isMissingOrganizationMembership(error: unknown): boolean {
  return fieldOf(error, 'name') === 'OauthException' && fieldOf(error, 'status') === 400
    && fieldOf(error, 'error') === 'organization_membership_not_found';
}
