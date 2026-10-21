import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorkOSBrowserSession } from '../../../src/accounts/providers/workos/workos-browser-session.ts';
import { authority, settings, signInCookieHeader, sessionEnvelopeIn, WorkOSSessionClientDouble } from './fixtures/workos-session-client-double.ts';

test('Given an opt-in onboarding policy, when a trusted code exchange completes, then the policy gets the exchange before its returned seal enters the cookie, and Google gives no MFA evidence', async () => {
  const client = new WorkOSSessionClientDouble();
  client.exchange = { ...client.exchange as Exclude<typeof client.exchange, Error>, authenticationMethod: 'GoogleOAuth' };
  const session = new WorkOSBrowserSession({ workos: client, settings, authority, onboarding: { complete: async (exchange) => {
    assert.deepEqual(client.methods(), ['authenticateWithCode']);
    assert.deepEqual(exchange, client.exchange);
    return { ...exchange, sealedSession: 'onboarded-seal' };
  } } });
  const cookieHeader = signInCookieHeader({ state: 'state', codeVerifier: 'verifier', returnTo: '/', expiresAt: Date.now() + 60_000 });
  const result = await session.completeSignIn({ cookieHeader, query: new URLSearchParams('code=code&state=state') });
  assert.equal(sessionEnvelopeIn(result.cookies[1])?.seal, 'onboarded-seal');
  assert.equal(sessionEnvelopeIn(result.cookies[1])?.mfa, false);
});

test('Given a code exchange without a sealed session, when sign-in completes, then onboarding cannot create a grant', async () => {
  const client = new WorkOSSessionClientDouble();
  client.exchange = { user: { id: 'user', email: 'new@thermus.ai', firstName: null, lastName: null, emailVerified: true }, authenticationMethod: 'GoogleOAuth' };
  let calls = 0;
  const session = new WorkOSBrowserSession({ workos: client, settings, authority, onboarding: { complete: async (exchange) => { calls += 1; return exchange; } } });
  const cookieHeader = signInCookieHeader({ state: 'state', codeVerifier: 'verifier', returnTo: '/', expiresAt: Date.now() + 60_000 });
  await assert.rejects(session.completeSignIn({ cookieHeader, query: new URLSearchParams('code=code&state=state') }));
  assert.equal(calls, 0);
});
