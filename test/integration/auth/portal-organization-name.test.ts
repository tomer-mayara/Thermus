import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { portalAccessOperation } from '../../../src/interfaces/web/account/portal-access.ts';
import { portalBaseUrl as base, portalContext as contextWith, productUserGrant as user } from './fixtures/portal-access-context.ts';

describe('Organization display name of the portal', () => {
  test('Given authorized product access, when its display name is read, then the lookup uses the trusted subject and selected organization', async () => {
    const context = contextWith([user]);
    const reads: unknown[] = [];
    const operation = portalAccessOperation(base, 'https://mcp.example/mcp', async (identity, organizationId) => {
      reads.push({ identity, organizationId });
      return 'Acme Labs';
    });
    await operation(new Request(`${base}/portal/access`), context);
    assert.deepEqual(reads, [{ identity: context.user, organizationId: 'org_01ACME' }]);
  });

  test('Given no product access, when its name is requested, then the operation refuses access before the name lookup', async () => {
    const operation = portalAccessOperation(base, 'https://mcp.example/mcp', async () => assert.fail('Unauthorized name read'));
    const response = await operation(new Request(`${base}/portal/access`), contextWith([]));
    assert.equal(response.status, 403);
  });

  for (const name of [undefined, '', ' ']) {
    test(`Given a missing active organization name (${JSON.stringify(name)}), when product access loads, then the endpoint returns a safe retryable failure`, async () => {
      const operation = portalAccessOperation(base, 'https://mcp.example/mcp', async () => name);
      const response = await operation(new Request(`${base}/portal/access`), contextWith([user]));
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { access: 'unavailable' });
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
    });
  }

  test('Given cancellation while the current name is loading, when its provider read settles, then the request stays cancelled', async () => {
    const pending = Promise.withResolvers<string>();
    const reading = Promise.withResolvers<void>();
    const operation = portalAccessOperation(base, 'https://mcp.example/mcp', () => { reading.resolve(); return pending.promise; });
    const cancellation = new AbortController();
    const response = operation(new Request(`${base}/portal/access`, { signal: cancellation.signal }), contextWith([user]));
    await reading.promise;
    cancellation.abort(new Error('cancelled'));
    pending.resolve('Acme Labs');
    await assert.rejects(response, /cancelled/);
  });
});
