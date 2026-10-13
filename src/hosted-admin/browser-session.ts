import type { AuthenticatedUser } from '../auth/access-context.ts';

// "unavailable" means that hosted authentication cannot sign anyone in, so no sign-in can be offered.
export type BrowserSessionState =
  | { readonly status: 'signed-in'; readonly user: AuthenticatedUser }
  | { readonly status: 'signed-out' }
  | { readonly status: 'unavailable' };

// The provider gets only the Cookie header, so no form field, query, or other header can choose the user or the
// organization. A lookup failure, such as an outage, throws, so it cannot erase a session.
export interface BrowserSession {
  authenticate(cookieHeader: string | null): Promise<BrowserSessionState>;
}
