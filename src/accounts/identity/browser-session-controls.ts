import type { BrowserSession, CookieEffects, SignedInBrowserSession } from './browser-session.ts';

// Profile values are display data. They do not grant access.
export interface BrowserProfile {
  readonly email: string;
  readonly firstName?: string;
  readonly lastName?: string;
}

export interface ProfiledSignedInBrowserSession extends SignedInBrowserSession {
  readonly profile: BrowserProfile;
}

export type ProfiledBrowserSessionState =
  | ProfiledSignedInBrowserSession
  | { readonly status: 'signed-out'; readonly cookies: CookieEffects };

export interface BrowserSignInStart {
  readonly url: string;
  readonly cookies: CookieEffects;
}

export type BrowserSignInCompletion =
  | { readonly status: 'signed-in'; readonly returnTo: string; readonly cookies: CookieEffects }
  | { readonly status: 'refused'; readonly cookies: CookieEffects };

export interface SessionEnd {
  // Opening this URL ends the provider session. It is absent without a usable session.
  readonly logoutUrl?: string;
  readonly cookies: CookieEffects;
}

// Browser routes pass callback input through. The adapter verifies provider state and protects session cookies.
export interface BrowserSessionControls extends BrowserSession {
  authenticate(cookieHeader: string | null): Promise<ProfiledBrowserSessionState>;
  startSignIn(request: { readonly returnTo: string }): Promise<BrowserSignInStart>;
  completeSignIn(callback: { readonly query: URLSearchParams; readonly cookieHeader: string | null }): Promise<BrowserSignInCompletion>;
  endSession(cookieHeader: string | null): Promise<SessionEnd>;
  csrfTokenOf(cookieHeader: string | null): string | undefined;
}
