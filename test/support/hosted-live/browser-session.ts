import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import type { AuthenticationResponse, RefreshSessionResponse, WorkOS } from '@workos-inc/node';
import type { Page } from 'playwright';
import { visitAuthKit, type AuthKitVisit } from './authkit-driver.ts';
import type { LiveBrowser } from './live-browser.ts';
import { browserRedirectUri, type HostedLiveSettings } from './settings.ts';
import type { LiveUser } from './staging-fixtures.ts';
import { readToken, type TokenView } from './tokens.ts';

interface SignInRequest {
  readonly user: LiveUser;
  readonly organizationName?: string;
}

export interface BrowserSignIn {
  readonly visit: AuthKitVisit;
  readonly stateMatches: boolean;
  readonly exchange: AuthenticationResponse;
  readonly cookiePasswordLength: number;
  readonly session: BrowserSession;
  readonly page: Page;
}

export interface SignInServices {
  readonly settings: HostedLiveSettings;
  readonly workos: WorkOS;
  readonly browser: LiveBrowser;
}

// The sealed session that a hosted server keeps in its cookie. It holds the latest seal after each refresh.
export class BrowserSession {
  readonly #workos: WorkOS;
  readonly #cookiePassword: string;
  #sealed: string;
  readonly userId: string;
  readonly sessionId: string;

  constructor(workos: WorkOS, exchange: AuthenticationResponse, cookiePassword: string) {
    assert.ok(exchange.sealedSession, 'The code exchange gave no sealed session.');
    this.#workos = workos;
    this.#cookiePassword = cookiePassword;
    this.#sealed = exchange.sealedSession;
    this.userId = exchange.user.id;
    this.sessionId = String(readToken(exchange.accessToken).claims.sid);
  }

  async refresh(organizationId?: string): Promise<RefreshSessionResponse> {
    const sealed = this.#workos.userManagement.loadSealedSession({ sessionData: this.#sealed, cookiePassword: this.#cookiePassword });
    const result = await sealed.refresh({ cookiePassword: this.#cookiePassword, organizationId });
    if (result.authenticated && result.sealedSession) this.#sealed = result.sealedSession;
    return result;
  }

  async listed(): Promise<boolean> {
    const sessions = await (await this.#workos.userManagement.listSessions(this.userId)).autoPagination();
    return sessions.some(({ id }) => id === this.sessionId);
  }
}

export function refreshedAccessToken(result: RefreshSessionResponse): string {
  if (!result.authenticated) assert.fail(`The session did not refresh: ${result.reason}, retryable ${String(result.retryable)}.`);
  assert.ok(result.session, 'The refresh gave no session.');
  return result.session.accessToken;
}

export function refreshedToken(result: RefreshSessionResponse): TokenView {
  return readToken(refreshedAccessToken(result));
}

// A browser sign-in of the hosted edition, with PKCE and a sealed session; the callback is intercepted.
export async function signInWithAuthKit(services: SignInServices, request: SignInRequest): Promise<BrowserSignIn> {
  const { settings, workos, browser } = services;
  const { url, state, codeVerifier } = await workos.userManagement.getAuthorizationUrlWithPKCE({ provider: 'authkit', redirectUri: browserRedirectUri, clientId: settings.clientId });
  const page = await browser.newPage();
  const authkitHost = new URL(settings.authkitIssuer).host;
  const visit = await visitAuthKit(page, url, { ...request, authkitHost, callback: browserRedirectUri, mfaPolicy: settings.mfaPolicy });
  const code = visit.callback.searchParams.get('code');
  assert.ok(code, `The callback has no authorization code. It has: ${[...visit.callback.searchParams.keys()].join(', ')}.`);
  const cookiePassword = randomBytes(32).toString('base64url');
  const exchange = await workos.userManagement.authenticateWithCode({ clientId: settings.clientId, code, codeVerifier, session: { sealSession: true, cookiePassword } });
  const stateMatches = visit.callback.searchParams.get('state') === state;
  return { visit, stateMatches, exchange, cookiePasswordLength: cookiePassword.length, session: new BrowserSession(workos, exchange, cookiePassword), page };
}
