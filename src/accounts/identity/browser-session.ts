import type { AuthenticatedUser } from './access-context.ts';

// Set-Cookie values that the browser must get with the answer to its request, also with a redirect or an error page.
// Otherwise a browser could lose a session that the provider refreshed or ended during the request.
export type CookieEffects = readonly string[];

export type OrganizationSwitch =
  | { readonly status: 'switched'; readonly cookies: CookieEffects }
  | { readonly status: 'refused'; readonly cookies: CookieEffects }
  | { readonly status: 'signed-out'; readonly cookies: CookieEffects };

export interface SignedInBrowserSession {
  readonly status: 'signed-in';
  readonly user: AuthenticatedUser;
  // A secret of this session. Each form of the account pages sends it back, so that another site cannot post a form.
  // It stays the same for the whole session, also after a refresh or a switch, so that a form shown before still posts.
  readonly csrfToken: string;
  // True only when the provider proved that the sign-in of this session completed a multi-factor challenge. An
  // enrollment alone is no proof. A role does not itself require this proof.
  readonly mfaCompleted: boolean;
  readonly cookies: CookieEffects;
  // Only this call changes the organization of the session, and only for this browser. Account routes first confirm
  // an authorized active membership. Signup first confirms active product access. A failure, such as an outage, throws.
  selectOrganization(organizationId: string): Promise<OrganizationSwitch>;
}

export type BrowserSessionState =
  | SignedInBrowserSession
  | { readonly status: 'signed-out'; readonly cookies: CookieEffects };

// The provider gets only the Cookie header, so no form field, query, or other header can choose the user or the
// organization of the session. A lookup failure, such as an outage, throws, so it cannot erase a session.
export interface BrowserSession {
  authenticate(cookieHeader: string | null): Promise<BrowserSessionState>;
}
