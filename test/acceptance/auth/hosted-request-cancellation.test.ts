import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { hostedConfig, openOrganizationSite, userOf } from '../../support/in-process/hosted-organization-site.ts';

for (const stage of ['session', 'access'] as const) {
  for (const stop of ['disconnect', 'shutdown'] as const) {
    test(`Given an account request waiting for ${stage}, when ${stop} occurs, then its wait ends and its protected operation never starts`, { timeout: 3_000 }, async (t) => {
      const site = openOrganizationSite(t, { reportFailure: () => {} });
      const cookie = site.sessions.signIn(userOf('user-mia', 'org-a'));
      const entered = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const authenticate = site.sessions.authenticate.bind(site.sessions);
      const resolve = site.directory.resolve.bind(site.directory);
      if (stage === 'session') t.mock.method(site.sessions, 'authenticate', async (header: string | null) => { entered.resolve(); await release.promise; return authenticate(header); });
      else t.mock.method(site.directory, 'resolve', async (user: Parameters<typeof resolve>[0]) => { entered.resolve(); await release.promise; return resolve(user); });
      const client = new AbortController();
      const pending = site.application.handle(new Request(new URL('portal', hostedConfig.publicBaseUrl), { headers: { Cookie: cookie }, signal: client.signal }));
      const settled = pending.then(() => 'response', () => 'cancelled');
      t.after(async () => { release.resolve(); await settled; });
      await entered.promise;

      if (stop === 'disconnect') client.abort();
      else await site.application.close();
      assert.equal(await Promise.race([settled, delay(500).then(() => 'waiting')]), 'cancelled');
      release.resolve();
      await delay(20);

      assert.equal(site.pages.work.length, 0);
    });
  }
}
