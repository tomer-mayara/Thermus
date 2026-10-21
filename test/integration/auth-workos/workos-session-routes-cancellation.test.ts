import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { browserRequest, csrfToken, logoutPost, serve, SessionDouble } from './fixtures/session-routes-fixtures.ts';

for (const method of ['authenticate', 'startSignIn', 'completeSignIn', 'endSession'] as const) {
  test(`Given ${method} waiting on WorkOS, when the browser disconnects, then the request stops waiting and observes a later failure`, async (t) => {
    const pending = Promise.withResolvers<never>();
    const session = new SessionDouble();
    const entered = Promise.withResolvers<void>();
    t.mock.method(session, method, () => { entered.resolve(); return pending.promise; });
    const { routes, failures } = serve(session);
    const controller = new AbortController();
    const paths = { authenticate: 'session', startSignIn: 'login', completeSignIn: 'callback', endSession: 'logout' };
    const request = method === 'endSession'
      ? new Request(logoutPost(new URLSearchParams({ csrf_token: csrfToken }).toString()), { signal: controller.signal })
      : browserRequest(`/team/${paths[method]}`, { signal: controller.signal });
    const answer = routes.handle(request).then(() => 'response', () => 'cancelled');
    t.after(() => pending.reject(new Error('late WorkOS failure')));

    await entered.promise;
    controller.abort();
    assert.equal(await Promise.race([answer, delay(100).then(() => 'waiting')]), 'cancelled');
    assert.deepEqual(failures, []);
  });
}
