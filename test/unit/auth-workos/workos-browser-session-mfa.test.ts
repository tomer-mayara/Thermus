import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  browserSession, cookieHeader, cookieHeaderOf, envelope, sessionEnvelopeIn,
  signedIn, signInCookieHeader, WorkOSSessionClientDouble,
} from './fixtures/workos-session-client-double.ts';

for (const method of ['Password', 'GoogleOAuth']) {
  test(`Given a ${method} code exchange, when sign-in completes, then the new cookie has no MFA evidence`, async () => {
    const client = new WorkOSSessionClientDouble();
    client.exchange = { ...client.exchange as Exclude<typeof client.exchange, Error>, authenticationMethod: method };
    const header = signInCookieHeader({ state: 'state', codeVerifier: 'verifier', returnTo: '/', expiresAt: Date.now() + 60_000 });
    const completion = await browserSession(client).completeSignIn({ cookieHeader: header, query: new URLSearchParams('code=code&state=state') });
    assert.equal(completion.status, 'signed-in');
    assert.equal(sessionEnvelopeIn(completion.cookies[1])?.mfa, false);
  });
}

test('Given an old cookie with inferred MFA evidence, when its seal verifies, then the session exposes no MFA evidence and keeps its identity and CSRF token', async () => {
  const client = new WorkOSSessionClientDouble();
  const session = signedIn(await browserSession(client).authenticate(cookieHeader));
  assert.equal(session.mfaCompleted, false);
  assert.equal(session.user.selectedOrganizationId, 'org_01ACME');
  assert.equal(session.csrfToken, envelope.csrf);
});

test('Given an old cookie with inferred MFA evidence, when its expired seal refreshes, then both the session and replacement cookie have no MFA evidence', async () => {
  const client = new WorkOSSessionClientDouble();
  client.check = () => ({ authenticated: false, reason: 'invalid_jwt' });
  const session = signedIn(await browserSession(client).authenticate(cookieHeader));
  assert.equal(session.mfaCompleted, false);
  assert.deepEqual(sessionEnvelopeIn(session.cookies[0]), { ...envelope, seal: 'seal-2', mfa: false });
});

test('Given an old cookie with inferred MFA evidence, when the session switches organization, then the switched cookie and its session have no MFA evidence', async () => {
  const client = new WorkOSSessionClientDouble();
  const browser = browserSession(client);
  const session = signedIn(await browser.authenticate(cookieHeader));
  const changed = await session.selectOrganization('org_02OTHER');
  assert.equal(changed.status, 'switched');
  assert.equal(sessionEnvelopeIn(changed.cookies[0])?.mfa, false);
  assert.equal(signedIn(await browser.authenticate(cookieHeaderOf(changed.cookies))).mfaCompleted, false);
});
