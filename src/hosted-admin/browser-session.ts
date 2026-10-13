import type { AuthenticatedUser } from '../auth/access-context.ts';

// The browser session of one request. Only a session that the hosted provider verified gives a user, with the
// organization that the session selected. "unavailable" means that hosted authentication cannot sign anyone in.
export type BrowserSessionState =
  | { readonly status: 'signed-in'; readonly user: AuthenticatedUser }
  | { readonly status: 'signed-out' }
  | { readonly status: 'unavailable' };

// The browser-session role that the hosted account routes need. The hosted provider implements it and owns its
// cookies; it never takes the user or the organization from a form field, a query, or another header. A lookup
// failure, such as a provider outage, throws: it never becomes a signed-out or signed-in state.
export interface BrowserSession {
  authenticate(request: Request): Promise<BrowserSessionState>;
}
