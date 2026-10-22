import { sessionCookie } from '../../../src/accounts/providers/workos/session-cookies.ts';

// Keep the real WorkOS seal and the CSRF token, with the inferred bit written by the old Required policy.
export function legacyMfaSessionCookie(cookieHeader: string | undefined, cookiePassword: string): string {
  const cookie = sessionCookie(cookiePassword);
  const session = cookie.contentOf(cookieHeader ?? null);
  if (session === undefined) throw new Error('The legacy fixture needs a signed-in session cookie.');
  return cookie.setCookie({ ...session, mfa: true }).split(';')[0];
}
