import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { accountRequest } from './fixtures/account-routes-fixtures.ts';
import { selection, serveAnn, validSelection } from './fixtures/organization-routes-fixtures.ts';

for (const read of ['listOrganizations', 'authorizeSelection'] as const) {
  test(`Given ${read} waiting for the provider, when the browser disconnects, then the wait ends and a later result cannot switch the organization`, async (t) => {
    const { routes, organizations, annSession } = serveAnn();
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    if (read === 'listOrganizations') {
      const original = organizations.listOrganizations.bind(organizations);
      t.mock.method(organizations, read, async (...args: Parameters<typeof original>) => { entered.resolve(); await release.promise; return original(...args); });
    } else {
      const original = organizations.authorizeSelection.bind(organizations);
      t.mock.method(organizations, read, async (...args: Parameters<typeof original>) => { entered.resolve(); await release.promise; return original(...args); });
    }
    const stop = new AbortController();
    const request = new Request(read === 'listOrganizations' ? accountRequest('/organizations', 'session=ann') : selection(validSelection), { signal: stop.signal });
    const pending = routes.handle(request).then(() => 'response', () => 'cancelled');
    t.after(async () => { release.resolve(); await pending; });
    await entered.promise;

    stop.abort();
    assert.equal(await Promise.race([pending, delay(100).then(() => 'waiting')]), 'cancelled');
    release.resolve();
    await delay(10);
    assert.deepEqual(annSession.switches, []);
  });
}
