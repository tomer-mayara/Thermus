import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { CookieEffects } from '../../../../src/accounts/identity/browser-session.ts';
import type { BrowserSessionControls, BrowserSignInCompletion, BrowserSignInStart, ProfiledBrowserSessionState, ProfiledSignedInBrowserSession, SessionEnd } from '../../../../src/accounts/identity/browser-session-controls.ts';
import { WorkOSSessionRoutes, type SessionRouteFailure } from '../../../../src/interfaces/web/auth/workos/workos-session-routes.ts';

export const publicBaseUrl = 'https://thermus.example/team/';
export const publicOrigin = 'https://thermus.example';
export const redirectUri = 'https://thermus.example/team/callback';
export const authKitUrl = 'https://api.workos.example/user_management/authorize?client_id=client_01TEST&state=state-1';
export const logoutUrl = 'https://api.workos.example/user_management/sessions/logout?session_id=session_01ADA';
export const signInCookie = '__Host-thermus-sign-in=v1.started; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600';
export const clearedSignInCookie = '__Host-thermus-sign-in=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';
export const sessionCookie = '__Host-thermus-session=v1.session; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000';
export const clearedSessionCookie = '__Host-thermus-session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';
export const csrfToken = 'csrf-token-of-ada-0123456789';
export const browserCookies = '__Host-thermus-session=v1.session; __Host-thermus-sign-in=v1.started';

type Answer<T> = T | Error;

export interface SessionCall {
  readonly method: string;
  readonly input: unknown;
}

export function signedInState(changes: Partial<ProfiledSignedInBrowserSession> = {}): ProfiledSignedInBrowserSession {
  return {
    status: 'signed-in',
    user: { authority: 'workos:client_01TEST', subject: 'user_01ADA', selectedOrganizationId: 'org_01ACME' },
    profile: { email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace' },
    csrfToken,
    mfaCompleted: true,
    cookies: [],
    selectOrganization: async () => assert.fail('the session routes never switch the organization'),
    ...changes,
  };
}

// A double of the browser session controls with configured answers. It records each call in order.
export class SessionDouble implements BrowserSessionControls {
  readonly calls: SessionCall[] = [];
  state: Answer<ProfiledBrowserSessionState> = signedInState();
  start: Answer<BrowserSignInStart> = { url: authKitUrl, cookies: [signInCookie] };
  completion: Answer<BrowserSignInCompletion> = { status: 'signed-in', returnTo: '/team/members', cookies: [clearedSignInCookie, sessionCookie] };
  end: Answer<SessionEnd> = { logoutUrl, cookies: [clearedSessionCookie] };
  token: string | undefined = csrfToken;

  async authenticate(cookieHeader: string | null): Promise<ProfiledBrowserSessionState> {
    return this.answer('authenticate', cookieHeader, this.state);
  }

  async startSignIn(request: { readonly returnTo: string }): Promise<BrowserSignInStart> {
    return this.answer('startSignIn', request, this.start);
  }

  async completeSignIn(callback: Parameters<BrowserSessionControls['completeSignIn']>[0]): Promise<BrowserSignInCompletion> {
    return this.answer('completeSignIn', { query: callback.query.toString(), cookieHeader: callback.cookieHeader }, this.completion);
  }

  async endSession(cookieHeader: string | null): Promise<SessionEnd> {
    return this.answer('endSession', cookieHeader, this.end);
  }

  csrfTokenOf(cookieHeader: string | null): string | undefined {
    this.calls.push({ method: 'csrfTokenOf', input: cookieHeader });
    return this.token;
  }

  methods(): string[] {
    return this.calls.map(({ method }) => method);
  }

  private answer<T>(method: string, input: unknown, configured: Answer<T>): T {
    this.calls.push({ method, input });
    if (configured instanceof Error) throw configured;
    return configured;
  }
}

export function serve(session = new SessionDouble(), base = publicBaseUrl) {
  const failures: SessionRouteFailure[] = [];
  const routes = new WorkOSSessionRoutes({ session, publicBaseUrl: base, redirectUri, reportFailure: (report) => failures.push(report) });
  return { routes, session, failures };
}

export function browserRequest(path: string, init: RequestInit = {}, cookies: string | null = browserCookies): Request {
  const headers = new Headers(init.headers);
  if (cookies !== null) headers.set('Cookie', cookies);
  return new Request(new URL(path, publicOrigin), { ...init, headers });
}

export function logoutPost(body: RequestInit['body'], headers: Readonly<Record<string, string>> = {}): Request {
  return browserRequest('/team/logout', {
    method: 'POST',
    headers: { Origin: publicOrigin, 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
    body,
    duplex: 'half',
  });
}

export interface ExpectedPage {
  readonly status: number;
  readonly text: RegExp;
  readonly cookies?: CookieEffects;
  readonly allow?: string;
}

// Each page allows nothing but its own inline style, which the policy names by its hash.
export async function assertPage(response: Response, expected: ExpectedPage): Promise<string> {
  assert.equal(response.status, expected.status);
  assert.deepEqual(response.headers.getSetCookie(), expected.cookies ?? []);
  assert.equal(response.headers.get('Allow'), expected.allow ?? null);
  const body = await response.text();
  const style = /<style>([^<]*)<\/style>/.exec(body)?.[1] ?? '';
  const styleHash = createHash('sha256').update(style).digest('base64');
  const headers = Object.fromEntries([...response.headers].filter(([name]) => name !== 'set-cookie' && name !== 'allow'));
  assert.deepEqual(headers, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'content-security-policy': `default-src 'none'; style-src 'sha256-${styleHash}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
  });
  assert.notEqual(style, '');
  assert.match(body, expected.text);
  assert.doesNotMatch(body, /<form|<input|<script|<link|<img/i);
  return body;
}

export function assertRedirect(response: Response, location: string, cookies: CookieEffects): void {
  assert.equal(response.status, 303);
  assert.deepEqual(response.headers.getSetCookie(), cookies);
  const headers = Object.fromEntries([...response.headers].filter(([name]) => name !== 'set-cookie'));
  assert.deepEqual(headers, { location, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
}

export interface ExpectedJson {
  readonly status: number;
  readonly body: unknown;
  readonly cookies?: CookieEffects;
}

export async function assertJson(response: Response, { status, body, cookies = [] }: ExpectedJson): Promise<void> {
  assert.equal(response.status, status);
  assert.deepEqual(response.headers.getSetCookie(), cookies);
  assert.equal(response.headers.get('Content-Type'), 'application/json');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(await response.text(), JSON.stringify(body));
}
