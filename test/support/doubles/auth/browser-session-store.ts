import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '../../../../src/auth/access-context.ts';
import type { BrowserSession, BrowserSessionState, CookieEffects, OrganizationSwitch } from '../../../../src/auth/hosted-auth/browser-session.ts';

const COOKIE_NAME = 'session';
const COOKIE_ATTRIBUTES = 'Path=/; Secure; HttpOnly; SameSite=Lax';
export const CLEARED_SESSION_COOKIE = `${COOKIE_NAME}=; Max-Age=0; ${COOKIE_ATTRIBUTES}`;

interface StoredSession {
  readonly user: AuthenticatedUser;
  readonly csrfToken: string;
  readonly mfaCompleted: boolean;
  readonly refreshDue: boolean;
}

export interface SignInOptions {
  // Whether the sign-in completed a multi-factor challenge. The default is true.
  readonly mfaCompleted?: boolean;
}

interface SessionSwitch {
  readonly subject: string;
  readonly organizationId: string;
}

// A stand-in for the hosted browser session of AUTH-06. The session cookie holds a key that changes at each refresh, as
// with a provider that rotates its refresh tokens: the old key then ends. A refresh happens when the access token of a
// session has expired and when the organization of the session changes. A browser that does not get the new cookie is
// signed out at its next request.
export class BrowserSessionStore implements BrowserSession {
  readonly lookups: (string | null)[] = [];
  readonly switches: SessionSwitch[] = [];
  private readonly sessions = new Map<string, StoredSession>();
  private outage?: Error;

  signIn(user: AuthenticatedUser, options: SignInOptions = {}): string {
    return `${COOKIE_NAME}=${this.store({ user, csrfToken: randomUUID(), mfaCompleted: options.mfaCompleted ?? true, refreshDue: false })}`;
  }

  expireAccessToken(cookieHeader: string | undefined): void {
    const key = keyIn(cookieHeader ?? null);
    const stored = key === undefined ? undefined : this.sessions.get(key);
    assert.ok(key !== undefined && stored !== undefined, `no stored session has the cookie ${cookieHeader}`);
    this.sessions.set(key, { ...stored, refreshDue: true });
  }

  failLookups(outage: Error | undefined): void {
    this.outage = outage;
  }

  async authenticate(cookieHeader: string | null): Promise<BrowserSessionState> {
    this.lookups.push(cookieHeader);
    if (this.outage !== undefined) throw this.outage;
    const key = keyIn(cookieHeader);
    if (key === undefined) return { status: 'signed-out', cookies: [] };
    const stored = this.sessions.get(key);
    if (stored === undefined) return { status: 'signed-out', cookies: [CLEARED_SESSION_COOKIE] };
    if (!stored.refreshDue) return this.signedIn(key, []);
    const refreshed = this.refresh(key, stored.user);
    return this.signedIn(refreshed, [sessionCookie(refreshed)]);
  }

  private signedIn(key: string, cookies: CookieEffects): BrowserSessionState {
    const { user, csrfToken, mfaCompleted } = this.sessions.get(key) as StoredSession;
    return { status: 'signed-in', user, csrfToken, mfaCompleted, cookies, selectOrganization: (organizationId) => this.switchOrganization(key, organizationId) };
  }

  private async switchOrganization(key: string, organizationId: string): Promise<OrganizationSwitch> {
    const stored = this.sessions.get(key);
    if (stored === undefined) return { status: 'signed-out', cookies: [CLEARED_SESSION_COOKIE] };
    this.switches.push({ subject: stored.user.subject, organizationId });
    const switched = this.refresh(key, { ...stored.user, selectedOrganizationId: organizationId });
    return { status: 'switched', cookies: [sessionCookie(switched)] };
  }

  private refresh(key: string, user: AuthenticatedUser): string {
    const { csrfToken, mfaCompleted } = this.sessions.get(key) as StoredSession;
    this.sessions.delete(key);
    return this.store({ user, csrfToken, mfaCompleted, refreshDue: false });
  }

  private store(session: StoredSession): string {
    const key = randomUUID();
    this.sessions.set(key, session);
    return key;
  }
}

function sessionCookie(key: string): string {
  return `${COOKIE_NAME}=${key}; ${COOKIE_ATTRIBUTES}`;
}

function keyIn(cookieHeader: string | null): string | undefined {
  for (const pair of (cookieHeader ?? '').split(';')) {
    const [name, value] = pair.trim().split('=');
    if (name === COOKIE_NAME && value) return value;
  }
  return undefined;
}
