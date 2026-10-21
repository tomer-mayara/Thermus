import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { sessionCookie, signInCookie } from '../../../src/accounts/providers/workos/session-cookies.ts';
import {
  ada,
  authority,
  browserSession,
  clearedSessionCookie,
  cookieHeader,
  cookieHeaderOf,
  envelope,
  joseError,
  sealOptions,
  sessionCookieHeader,
  settings,
  signedIn,
  WorkOSSessionClientDouble,
} from './fixtures/workos-session-client-double.ts';

describe('WorkOSBrowserSession: the session check of each request', () => {
  test('Given a Cookie header without the session cookie, when the session authenticates, then it is signed out without a cookie change, and no WorkOS call runs', async () => {
    const client = new WorkOSSessionClientDouble();
    const signInOnly = cookieHeaderOf([signInCookie(settings.cookiePassword).setCookie({ state: 's', codeVerifier: 'v', returnTo: '/team/', expiresAt: 1 })]);

    for (const header of [null, '', 'theme=dark', signInOnly]) {
      assert.deepEqual(await browserSession(client).authenticate(header), { status: 'signed-out', cookies: [] }, String(header));
    }
    assert.deepEqual(client.calls, []);
  });

  test('Given a session cookie that does not open, when the session authenticates, then it is signed out with the cleared session cookie, and no WorkOS call runs', async () => {
    const client = new WorkOSSessionClientDouble();
    const headers = [
      '__Host-thermus-session=not-a-sealed-envelope',
      cookieHeaderOf([sessionCookie('another-cookie-password-0123456789-abcdef').setCookie(envelope)]),
      `${cookieHeader}; ${sessionCookieHeader({ ...envelope, csrf: 'another-token' })}`,
    ];

    for (const header of headers) {
      assert.deepEqual(await browserSession(client).authenticate(header), { status: 'signed-out', cookies: [clearedSessionCookie] }, header);
    }
    assert.deepEqual(client.calls, []);
  });

  test('Given a seal whose access token verifies, when the session authenticates, then it is signed in as the WorkOS user in the environment authority with the organization of the session, the profile, the CSRF token, and the MFA evidence of the sign-in, without a cookie change', async () => {
    const client = new WorkOSSessionClientDouble();

    const session = signedIn(await browserSession(client).authenticate(cookieHeader));

    assert.deepEqual(
      { user: session.user, profile: session.profile, csrfToken: session.csrfToken, mfaCompleted: session.mfaCompleted, cookies: session.cookies },
      {
        user: { authority, subject: ada.id, selectedOrganizationId: 'org_01ACME' },
        profile: { email: ada.email, firstName: ada.firstName, lastName: ada.lastName },
        csrfToken: envelope.csrf,
        mfaCompleted: true,
        cookies: [],
      },
    );
    assert.deepEqual(client.calls, [{ method: 'authenticate', input: sealOptions }]);
  });

  test('Given a valid seal of a session without an organization and of a user without names, when the session authenticates, then the user has no selected organization and the profile has the email only', async () => {
    const client = new WorkOSSessionClientDouble();
    client.check = () => ({ authenticated: true, user: { ...ada, firstName: null, lastName: null } });

    const session = signedIn(await browserSession(client).authenticate(sessionCookieHeader({ ...envelope, mfa: false })));

    assert.deepEqual([session.user, session.profile, session.mfaCompleted], [{ authority, subject: ada.id }, { email: ada.email }, false]);
  });

  test('Given a seal that the SDK reports as invalid_session_cookie or no_session_cookie_provided, when the session authenticates, then it is signed out with the cleared cookie, and no refresh runs', async () => {
    for (const reason of ['invalid_session_cookie', 'no_session_cookie_provided']) {
      const client = new WorkOSSessionClientDouble();
      client.check = () => ({ authenticated: false, reason });

      assert.deepEqual(await browserSession(client).authenticate(cookieHeader), { status: 'signed-out', cookies: [clearedSessionCookie] }, reason);
      assert.deepEqual(client.methods(), ['authenticate'], reason);
    }
  });

  test('Given a damaged seal that makes the SDK throw InvalidCharacterError or "Invalid expiration", when the session authenticates, then it is signed out with the cleared cookie, and no refresh runs', async () => {
    for (const error of [new DOMException('Invalid character', 'InvalidCharacterError'), new Error('Invalid expiration')]) {
      const client = new WorkOSSessionClientDouble();
      client.check = () => error;

      assert.deepEqual(await browserSession(client).authenticate(cookieHeader), { status: 'signed-out', cookies: [clearedSessionCookie] }, error.name);
      assert.deepEqual(client.methods(), ['authenticate'], error.name);
    }
  });


  test('Given a key-set outage or another unexpected SDK error, when the session authenticates, then it rejects with that error and runs no refresh, so the cookie stays', async () => {
    const errors = [
      joseError('JWKSTimeout', 'ERR_JWKS_TIMEOUT'),
      joseError('JOSEError', 'ERR_JOSE_GENERIC'),
      new TypeError('fetch failed'),
      new Error('Missing client ID. Did you provide it when initializing WorkOS?'),
    ];

    for (const error of errors) {
      const client = new WorkOSSessionClientDouble();
      client.check = () => error;

      await assert.rejects(browserSession(client).authenticate(cookieHeader), (thrown) => thrown === error);
      assert.deepEqual(client.methods(), ['authenticate'], error.message);
    }
  });

});
