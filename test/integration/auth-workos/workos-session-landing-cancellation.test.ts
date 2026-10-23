import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { AccessResolverSpy } from '../../support/doubles/auth/access-resolver-spy.ts';
import { browserRequest, clearedSignInCookie, publicBaseUrl, serve, SessionDouble, sessionCookie, signedInState } from './fixtures/session-routes-fixtures.ts';

test('Given a completed sign-in waiting for current landing access, when the browser disconnects, then no recovery page or operator report is returned and a later lookup failure is observed', { timeout: 1_000 }, async (t) => {
  const pending = Promise.withResolvers<never>();
  const entered = Promise.withResolvers<void>();
  const session = new SessionDouble();
  const user = signedInState().user;
  session.completion = { status: 'signed-in', user, cookies: [clearedSignInCookie, sessionCookie] };
  const resolver = new AccessResolverSpy(new Map([[user.subject, async () => { entered.resolve(); return pending.promise; }]]));
  const { routes, failures } = serve(session, publicBaseUrl, resolver);
  const controller = new AbortController();
  const answer = routes.handle(browserRequest('/team/callback?code=code&state=state', { signal: controller.signal }));
  t.after(() => pending.reject(new Error('late directory failure')));

  await entered.promise;
  controller.abort();

  await assert.rejects(answer, (cause: unknown) => {
    assert.equal(cause, controller.signal.reason);
    return true;
  });
  pending.reject(new Error('late directory failure'));
  await delay(0);
  assert.deepEqual(failures, []);
});
