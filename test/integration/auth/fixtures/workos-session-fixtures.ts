import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { decodeJwt } from 'jose';
import { WorkOSBrowserSession, type WorkOSSessionState, type WorkOSSignedInSession } from '../../../../src/auth/hosted-auth/workos/workos-browser-session.ts';
import { workosAuthority } from '../../../../src/auth/hosted-auth/workos/workos-settings.ts';
import { nowInSeconds, SigningKey } from '../../../support/doubles/workos/jwt-signing-key.ts';
import { cookiePassword, fakeClientId, WorkOSFakeApi, workosClientFor, type FakeAnswer, type FakeClientSettings } from '../../../support/doubles/workos/workos-fake-api.ts';
import { guardOutboundFetch } from '../../../support/isolation/outbound-fetch-guard.ts';

// A local session fixture for the browser session: the fake WorkOS API with a browser key set, and the real session
// with the pinned SDK client. The test plays AuthKit and scripts each answer of the API.

const settings = { clientId: fakeClientId, redirectUri: 'https://thermus.example/team/callback', cookiePassword };
export const authority = workosAuthority(fakeClientId);
export const authenticateRoute = 'POST /user_management/authenticate';
export const keySetRoute = `GET /sso/jwks/${fakeClientId}`;
export const clearedSessionCookie = '__Host-thermus-session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';
export const ada = {
  object: 'user',
  id: 'user_01ADA',
  email: 'ada@example.com',
  email_verified: true,
  first_name: 'Ada',
  last_name: 'Lovelace',
  profile_picture_url: null,
  last_sign_in_at: null,
  locale: null,
  external_id: null,
  metadata: {},
  created_at: '2026-10-01T08:00:00.000Z',
  updated_at: '2026-10-13T08:00:00.000Z',
};

interface SessionFixture {
  readonly fake: WorkOSFakeApi;
  readonly browserKey: SigningKey;
  readonly session: WorkOSBrowserSession;
}

// Each test of the suite may reach only the local fake. Call it in the describe block.
export function allowOnlyLoopbackRequests(): void {
  guardOutboundFetch({
    allowLoopback: true,
    refusal: 'Outbound network access is not allowed in these tests',
    finding: 'no request left the machine',
  });
}

export async function startSessionFixture(t: TestContext): Promise<SessionFixture> {
  const fake = await WorkOSFakeApi.start(t);
  const browserKey = await SigningKey.generate('browser-key-1');
  fake.browserKeySet.publish(browserKey);
  return { fake, browserKey, session: sessionFor(fake) };
}

export function sessionFor(fake: WorkOSFakeApi, client: FakeClientSettings = {}): WorkOSBrowserSession {
  return new WorkOSBrowserSession({ workos: workosClientFor(fake, client), settings, authority, mfaEvidence: 'password-mfa-required' });
}

export function accessToken(world: SessionFixture, organizationId: string, expired = false): Promise<string> {
  const now = nowInSeconds();
  return world.browserKey.sign(
    { sub: ada.id, sid: 'session_01ADA', client_id: fakeClientId, org_id: organizationId },
    { issuer: world.fake.browserIssuer, issuedAtUnixSeconds: expired ? now - 600 : now, expiresAtUnixSeconds: expired ? now - 300 : now + 300 },
  );
}

export function tokenAnswer(token: string, refreshToken: string): FakeAnswer {
  const body = { user: ada, organization_id: decodeJwt(token).org_id, access_token: token, refresh_token: refreshToken, authentication_method: 'Password' };
  return { status: 200, body };
}

// The Cookie header that a browser sends after it stored these Set-Cookie values.
export function cookieHeaderOf(setCookies: readonly string[]): string {
  return setCookies.map((setCookie) => setCookie.split(';')[0]).join('; ');
}

export function signedIn(state: WorkOSSessionState): WorkOSSignedInSession {
  if (state.status !== 'signed-in') assert.fail(`the session is ${state.status}`);
  return state;
}

export function grantsSent(fake: WorkOSFakeApi): ReadonlyArray<Readonly<Record<string, unknown>>> {
  return fake.takeRequests().filter(({ path }) => path === '/user_management/authenticate').map(({ body }) => body as Readonly<Record<string, unknown>>);
}

// The browser starts the sign-in and comes back from AuthKit with a code. Gives the Cookie header of the new session.
export async function signIn(world: SessionFixture, token: string): Promise<string> {
  const start = await world.session.startSignIn({ returnTo: '/team/' });
  world.fake.answer(authenticateRoute, tokenAnswer(token, 'refresh-1'));
  const state = new URL(start.url).searchParams.get('state') ?? '';
  const completion = await world.session.completeSignIn({ query: new URLSearchParams({ code: 'code-1', state }), cookieHeader: cookieHeaderOf(start.cookies) });
  if (completion.status !== 'signed-in') assert.fail(`the sign-in was refused: ${completion.reason}`);
  world.fake.takeRequests();
  return cookieHeaderOf(completion.cookies.slice(1));
}
