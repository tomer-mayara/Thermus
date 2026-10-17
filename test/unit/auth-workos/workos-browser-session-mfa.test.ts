import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorkOSBrowserSession } from '../../../src/auth/hosted-auth/workos/workos-browser-session.ts';
import {
  authority, cookieHeader, cookieHeaderOf, envelope, sessionEnvelopeIn, settings,
  signedIn, signInCookieHeader, WorkOSSessionClientDouble,
} from './fixtures/workos-session-client-double.ts';

function unprovenSession(client: WorkOSSessionClientDouble): WorkOSBrowserSession {
  return new WorkOSBrowserSession({ workos: client, settings, authority, mfaEvidence: 'unproven' });
}

for (const method of ['Password', 'GoogleOAuth']) {
  test(`Given unproven MFA mode, when a ${method} code exchange completes, then the new cookie has no MFA evidence`, async () => {
    const client = new WorkOSSessionClientDouble();
    client.exchange = { ...client.exchange as Exclude<typeof client.exchange, Error>, authenticationMethod: method };
    const header = signInCookieHeader({ state: 'state', codeVerifier: 'verifier', returnTo: '/', expiresAt: Date.now() + 60_000 });
    const completion = await unprovenSession(client).completeSignIn({ cookieHeader: header, query: new URLSearchParams('code=code&state=state') });
    assert.equal(completion.status, 'signed-in');
    assert.equal(sessionEnvelopeIn(completion.cookies[1])?.mfa, false);
  });
}

test('Given an existing cookie with MFA evidence and unproven mode, when its seal verifies, then the session exposes no MFA evidence and keeps its identity and CSRF token', async () => {
  const client = new WorkOSSessionClientDouble();
  const session = signedIn(await unprovenSession(client).authenticate(cookieHeader));
  assert.equal(session.mfaCompleted, false);
  assert.equal(session.user.selectedOrganizationId, 'org_01ACME');
  assert.equal(session.csrfToken, envelope.csrf);
});

test('Given an existing cookie with MFA evidence and unproven mode, when its expired seal refreshes, then both the session and replacement cookie have no MFA evidence', async () => {
  const client = new WorkOSSessionClientDouble();
  client.check = () => ({ authenticated: false, reason: 'invalid_jwt' });
  const session = signedIn(await unprovenSession(client).authenticate(cookieHeader));
  assert.equal(session.mfaCompleted, false);
  assert.deepEqual(sessionEnvelopeIn(session.cookies[0]), { ...envelope, seal: 'seal-2', mfa: false });
});

test('Given an existing cookie with MFA evidence and unproven mode, when the session switches organization, then the switched cookie and its session have no MFA evidence', async () => {
  const client = new WorkOSSessionClientDouble();
  const browser = unprovenSession(client);
  const session = signedIn(await browser.authenticate(cookieHeader));
  const changed = await session.selectOrganization('org_02OTHER');
  assert.equal(changed.status, 'switched');
  assert.equal(sessionEnvelopeIn(changed.cookies[0])?.mfa, false);
  assert.equal(signedIn(await browser.authenticate(cookieHeaderOf(changed.cookies))).mfaCompleted, false);
});

test('Given a browser session with no explicit MFA evidence policy, when Password sign-in completes and an old MFA cookie is read, then both report unproven MFA', async () => {
  const client = new WorkOSSessionClientDouble();
  const session = new WorkOSBrowserSession({ workos: client, settings, authority });
  const header = signInCookieHeader({ state: 'state', codeVerifier: 'verifier', returnTo: '/', expiresAt: Date.now() + 60_000 });
  const completion = await session.completeSignIn({ cookieHeader: header, query: new URLSearchParams('code=code&state=state') });
  assert.equal(sessionEnvelopeIn(completion.cookies[1])?.mfa, false);
  assert.equal(signedIn(await session.authenticate(cookieHeader)).mfaCompleted, false);
});
