import assert from 'node:assert/strict';
import { OauthException } from '@workos-inc/node';
import { sessionCookie, signInCookie, type SessionEnvelope, type SignInEnvelope } from '../../../../src/accounts/providers/workos/session-cookies.ts';
import { WorkOSBrowserSession } from '../../../../src/accounts/providers/workos/workos-browser-session.ts';
import type { ProfiledBrowserSessionState, ProfiledSignedInBrowserSession } from '../../../../src/accounts/identity/browser-session-controls.ts';
import type {
  CodeExchange,
  SealCheck,
  SealRefresh,
  StoredSession,
  WorkOSSessionClient,
} from '../../../../src/accounts/providers/workos/workos-session-client.ts';

export const settings = {
  clientId: 'client_01TEST',
  redirectUri: 'https://thermus.example/team/callback',
  cookiePassword: 'browser-session-test-password-0123456789',
} as const;
export const authority = 'workos:client_01TEST';
export const ada = { id: 'user_01ADA', email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace' } as const;
export const clearedSessionCookie = '__Host-thermus-session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';
export const clearedSignInCookie = '__Host-thermus-sign-in=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';

type Answer<T> = T | Error;

interface ClientCall {
  readonly method: string;
  readonly input: unknown;
}

// A narrow double of the WorkOS SDK client. Each test sets the answers it needs; each call is recorded in order.
export class WorkOSSessionClientDouble implements WorkOSSessionClient {
  readonly calls: ClientCall[] = [];
  authorization = { url: 'https://api.workos.example/user_management/authorize?state=state-1', state: 'state-1', codeVerifier: 'verifier-1' };
  check: (seal: string) => Answer<SealCheck> = () => checked('org_01ACME');
  refresh: (seal: string, organizationId?: string) => Answer<SealRefresh> = (_seal, organizationId) => refreshedTo('seal-2', organizationId ?? 'org_01ACME');
  exchange: Answer<CodeExchange> = { sealedSession: 'seal-1', user: ada, organizationId: 'org_01ACME', authenticationMethod: 'Password' };
  stored: Answer<StoredSession | undefined> = { accessToken: unsignedToken({ sid: 'session_01ADA' }) };

  readonly userManagement: WorkOSSessionClient['userManagement'] = {
    getAuthorizationUrlWithPKCE: async (options) => {
      this.record('getAuthorizationUrlWithPKCE', options);
      return this.authorization;
    },
    authenticateWithCode: async (payload) => {
      this.record('authenticateWithCode', payload);
      return answer(this.exchange);
    },
    loadSealedSession: ({ sessionData, cookiePassword }) => ({
      authenticate: async () => {
        this.record('authenticate', { sessionData, cookiePassword });
        return answer(this.check(sessionData));
      },
      refresh: async (options = {}) => {
        this.record('refresh', { sessionData, cookiePassword, ...options });
        return answer(this.refresh(sessionData, options.organizationId));
      },
    }),
    getSessionFromCookie: async (options) => {
      this.record('getSessionFromCookie', options);
      return answer(this.stored);
    },
    getLogoutUrl: (options) => {
      this.record('getLogoutUrl', options);
      return `https://api.workos.example/user_management/sessions/logout?session_id=${options.sessionId}`;
    },
  };

  methods(): string[] {
    return this.calls.map(({ method }) => method);
  }

  private record(method: string, input: unknown): void {
    this.calls.push({ method, input });
  }
}

function answer<T>(configured: Answer<T>): T {
  if (configured instanceof Error) throw configured;
  return configured;
}

function checked(organizationId?: string): SealCheck {
  return { authenticated: true, user: ada, ...(organizationId === undefined ? {} : { organizationId }) };
}

export function refreshedTo(seal: string, organizationId?: string): SealRefresh {
  return { authenticated: true, sealedSession: seal, user: ada, ...(organizationId === undefined ? {} : { organizationId }) };
}

// decodeJwt reads the claims without a signature check, so the double needs no key.
export function unsignedToken(claims: Readonly<Record<string, unknown>>): string {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'RS256', typ: 'JWT' })}.${part({ sub: ada.id, exp: 1, ...claims })}.signature`;
}

// The Cookie header that a browser sends after it stored these Set-Cookie values.
export function cookieHeaderOf(setCookies: readonly string[]): string {
  return setCookies.map((setCookie) => setCookie.split(';')[0]).join('; ');
}

export function sessionCookieHeader(envelope: SessionEnvelope): string {
  return cookieHeaderOf([sessionCookie(settings.cookiePassword).setCookie(envelope)]);
}

export function signInCookieHeader(envelope: SignInEnvelope): string {
  return cookieHeaderOf([signInCookie(settings.cookiePassword).setCookie(envelope)]);
}

export function sessionEnvelopeIn(setCookie: string | undefined): SessionEnvelope | undefined {
  return sessionCookie(settings.cookiePassword).contentOf(cookieHeaderOf(setCookie === undefined ? [] : [setCookie]));
}

export function signInEnvelopeIn(setCookie: string | undefined): SignInEnvelope | undefined {
  return signInCookie(settings.cookiePassword).contentOf(cookieHeaderOf(setCookie === undefined ? [] : [setCookie]));
}

export const envelope: SessionEnvelope = { seal: 'seal-1', csrf: 'csrf-token-of-ada', mfa: true };
export const cookieHeader = sessionCookieHeader(envelope);
export const sealOptions = { sessionData: 'seal-1', cookiePassword: settings.cookiePassword };

export function browserSession(client: WorkOSSessionClientDouble, clock?: () => number): WorkOSBrowserSession {
  return new WorkOSBrowserSession({ workos: client, settings, authority, mfaEvidence: 'password-mfa-required', ...(clock === undefined ? {} : { clock }) });
}

export function signedIn(state: ProfiledBrowserSessionState): ProfiledSignedInBrowserSession {
  if (state.status !== 'signed-in') assert.fail(`the session is ${state.status}`);
  return state;
}

// The SDK inlines its own copy of jose, so its errors are not instances of the jose error classes.
export function joseError(name: string, code: string): Error {
  return Object.assign(new Error(`${name} from the jose copy in the SDK`), { name, code });
}

export function terminalRefusal(reason: string): SealRefresh {
  return { authenticated: false, reason, retryable: false };
}

export function retryableFailure(reason: string, error: unknown): SealRefresh {
  return { authenticated: false, reason, retryable: true, error };
}

export function oauthError(status: number, error: string): OauthException {
  return new OauthException(status, 'request-1', error, `WorkOS refused: ${error}`, { error });
}
