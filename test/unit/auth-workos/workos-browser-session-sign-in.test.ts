import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { GenericServerException, OauthException, UnauthorizedException } from '@workos-inc/node';
import type { SignInEnvelope } from '../../../src/accounts/providers/workos/session-cookies.ts';
import { WorkOSBrowserSession } from '../../../src/accounts/providers/workos/workos-browser-session.ts';
import type { SignInRefusal } from '../../../src/accounts/providers/workos/workos-sign-in.ts';
import {
  ada,
  authority,
  clearedSignInCookie,
  sessionEnvelopeIn,
  settings,
  signInCookieHeader,
  signInEnvelopeIn,
  WorkOSSessionClientDouble,
} from './fixtures/workos-session-client-double.ts';

const startedAt = 1_800_000_000_000;
const signIn: SignInEnvelope = { state: 'state-of-the-sign-in', codeVerifier: 'verifier-of-the-sign-in', returnTo: '/team/members', expiresAt: startedAt + 600_000 };
const signInHeader = signInCookieHeader(signIn);

function browserSession(client: WorkOSSessionClientDouble, now = startedAt): WorkOSBrowserSession {
  return new WorkOSBrowserSession({ workos: client, settings, authority, mfaEvidence: 'password-mfa-required', clock: () => now });
}

function callback(query: string, cookieHeader: string | null = signInHeader) {
  return { query: new URLSearchParams(query), cookieHeader };
}

describe('WorkOSBrowserSession: the start of a sign-in', () => {
  test('Given a return path, when a sign-in starts, then WorkOS makes the AuthKit URL with PKCE for the redirect URI and the client ID, and the sign-in cookie holds the state, the verifier, the return path, and an expiry 10 minutes later', async () => {
    const client = new WorkOSSessionClientDouble();

    const start = await browserSession(client).startSignIn({ returnTo: '/team/members' });

    assert.equal(start.url, client.authorization.url);
    assert.deepEqual(client.calls, [{
      method: 'getAuthorizationUrlWithPKCE',
      input: { provider: 'authkit', redirectUri: settings.redirectUri, clientId: settings.clientId },
    }]);
    assert.equal(start.cookies.length, 1);
    assert.match(start.cookies[0] ?? '', /^__Host-thermus-sign-in=v1\.[\w-]+; HttpOnly; Secure; SameSite=Lax; Path=\/; Max-Age=600$/);
    assert.deepEqual(signInEnvelopeIn(start.cookies[0]), { state: 'state-1', codeVerifier: 'verifier-1', returnTo: '/team/members', expiresAt: startedAt + 600_000 });
  });
});

describe('WorkOSBrowserSession: the sign-in callback', () => {
  test('Given a started sign-in under an explicit Required MFA policy, when the callback brings a code and the same state, then the code is exchanged with the verifier for a sealed session, and the browser gets the cleared sign-in cookie and then a session cookie with the seal, a new CSRF token, and the MFA evidence of the password sign-in', async () => {
    const client = new WorkOSSessionClientDouble();

    const completion = await browserSession(client).completeSignIn(callback(`code=code-1&state=${signIn.state}&ignored=value`));

    assert.deepEqual(client.calls, [{
      method: 'authenticateWithCode',
      input: { clientId: settings.clientId, code: 'code-1', codeVerifier: signIn.codeVerifier, session: { sealSession: true, cookiePassword: settings.cookiePassword } },
    }]);
    if (completion.status !== 'signed-in') assert.fail(`the sign-in was refused: ${completion.reason}`);
    assert.equal(completion.returnTo, '/team/members');
    assert.equal(completion.cookies.length, 2);
    assert.equal(completion.cookies[0], clearedSignInCookie);
    const session = sessionEnvelopeIn(completion.cookies[1]);
    assert.equal(session?.seal, 'seal-1');
    assert.equal(session?.mfa, true);
    assert.match(session?.csrf ?? '', /^[\w-]{43}$/);
  });

  test('Given an explicit Required MFA policy and a sign-in with any method other than Password, when the code is exchanged, then the session has no MFA evidence, because WorkOS gives no MFA claim', async () => {
    for (const authenticationMethod of ['GoogleOAuth', 'SSO', 'MagicAuth', 'Passkey', 'Impersonation', undefined]) {
      const client = new WorkOSSessionClientDouble();
      client.exchange = { sealedSession: 'seal-1', user: ada, ...(authenticationMethod === undefined ? {} : { authenticationMethod }) };

      const completion = await browserSession(client).completeSignIn(callback(`code=code-1&state=${signIn.state}`));

      assert.equal(sessionEnvelopeIn(completion.cookies[1])?.mfa, false, String(authenticationMethod));
    }
  });

  test('Given two sign-ins, when both complete, then each session has its own CSRF token', async () => {
    const client = new WorkOSSessionClientDouble();
    const first = await browserSession(client).completeSignIn(callback(`code=code-1&state=${signIn.state}`));
    const second = await browserSession(client).completeSignIn(callback(`code=code-2&state=${signIn.state}`));

    assert.notEqual(sessionEnvelopeIn(first.cookies[1])?.csrf, sessionEnvelopeIn(second.cookies[1])?.csrf);
  });

  const refusals: ReadonlyArray<{ readonly when: string; readonly query: string; readonly cookieHeader?: string | null; readonly now?: number; readonly reason: SignInRefusal }> = [
    { when: 'the browser has no sign-in cookie', query: `code=code-1&state=${signIn.state}`, cookieHeader: null, reason: 'sign-in-missing' },
    { when: 'the sign-in cookie does not open', query: `code=code-1&state=${signIn.state}`, cookieHeader: '__Host-thermus-sign-in=forged', reason: 'sign-in-missing' },
    { when: 'the sign-in expired at this moment', query: `code=code-1&state=${signIn.state}`, now: signIn.expiresAt, reason: 'sign-in-expired' },
    { when: 'the sign-in expired before', query: `code=code-1&state=${signIn.state}`, now: signIn.expiresAt + 60_000, reason: 'sign-in-expired' },
    { when: 'AuthKit sends an error', query: `error=access_denied&state=${signIn.state}`, reason: 'provider-error' },
    { when: 'AuthKit sends an empty error with a code', query: `code=code-1&state=${signIn.state}&error=`, reason: 'provider-error' },
    { when: 'the code is missing', query: `state=${signIn.state}`, reason: 'invalid-callback' },
    { when: 'the code is empty', query: `code=&state=${signIn.state}`, reason: 'invalid-callback' },
    { when: 'the code appears two times', query: `code=code-1&code=code-2&state=${signIn.state}`, reason: 'invalid-callback' },
    { when: 'the state is missing', query: 'code=code-1', reason: 'invalid-callback' },
    { when: 'the state appears two times', query: `code=code-1&state=${signIn.state}&state=${signIn.state}`, reason: 'invalid-callback' },
    { when: 'the state differs', query: `code=code-1&state=${signIn.state.replace('state', 'stale')}`, reason: 'state-mismatch' },
    { when: 'the state has another length', query: `code=code-1&state=${signIn.state}-and-more`, reason: 'state-mismatch' },
  ];
  for (const { when, query, cookieHeader, now, reason } of refusals) {
    test(`Given a callback where ${when}, when it completes, then the sign-in is refused as ${reason} with the cleared sign-in cookie, and no code exchange runs`, async () => {
      const client = new WorkOSSessionClientDouble();

      const completion = await browserSession(client, now).completeSignIn(callback(query, cookieHeader === undefined ? signInHeader : cookieHeader));

      assert.deepEqual(completion, { status: 'refused', reason, cookies: [clearedSignInCookie] });
      assert.deepEqual(client.calls, []);
    });
  }

  test('Given a code that WorkOS refuses with a 4xx OAuth error, such as 400 invalid_grant, when the callback completes, then the sign-in is refused as code-refused with the cleared sign-in cookie', async () => {
    for (const status of [400, 403]) {
      const client = new WorkOSSessionClientDouble();
      client.exchange = new OauthException(status, 'request-1', 'invalid_grant', 'The code is not valid.', {});

      const completion = await browserSession(client).completeSignIn(callback(`code=code-1&state=${signIn.state}`));

      assert.deepEqual(completion, { status: 'refused', reason: 'code-refused', cookies: [clearedSignInCookie] });
    }
  });

  test('Given a code exchange that fails for another reason or gives no sealed session, when the callback completes, then it rejects, so the sign-in cookie stays for a new try', async () => {
    const answers = [
      new UnauthorizedException('request-1'),
      new GenericServerException(500, 'Internal error', {}, 'request-1'),
      new TypeError('fetch failed'),
      { user: ada, authenticationMethod: 'Password' },
    ];

    for (const answer of answers) {
      const client = new WorkOSSessionClientDouble();
      client.exchange = answer;

      await assert.rejects(browserSession(client).completeSignIn(callback(`code=code-1&state=${signIn.state}`)));
    }
  });
});
