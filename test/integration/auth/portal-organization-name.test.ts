import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { AuthenticatedUser } from '../../../src/accounts/identity/access-context.ts';
import { portalAccessOperation } from '../../../src/interfaces/web/account/portal-access.ts';
import { portalBaseUrl as base, portalContext as contextWith, productUserGrant as user } from './fixtures/portal-access-context.ts';

function nameRead(organizationNameOf: (user: AuthenticatedUser, organizationId: string) => Promise<string | undefined>) {
  return portalAccessOperation(base, 'https://mcp.example/mcp', { organizationNameOf, billingOf: async (organizationId) => ({ organizationId, plan: 'free', memberLimit: 5, billedSeats: 0 }) });
}

describe('Organization display name of the portal', () => {
  test('Given authorized product access, when its display name is read, then the lookup uses the trusted subject and selected organization', async () => {
    const context = contextWith([user]);
    const reads: unknown[] = [];
    const operation = nameRead(async (identity, organizationId) => {
      reads.push({ identity, organizationId });
      return 'Acme Labs';
    });
    await operation(new Request(`${base}/portal/access`), context);
    assert.deepEqual(reads, [{ identity: context.user, organizationId: 'org_01ACME' }]);
  });

  test('Given no product access, when its name is requested, then the operation refuses access before the name lookup', async () => {
    const operation = nameRead(async () => assert.fail('Unauthorized name read'));
    const response = await operation(new Request(`${base}/portal/access`), contextWith([]));
    assert.equal(response.status, 403);
  });

  for (const name of [undefined, '', ' ']) {
    test(`Given a missing active organization name (${JSON.stringify(name)}), when product access loads, then the endpoint returns a safe retryable failure`, async () => {
      const operation = nameRead(async () => name);
      const response = await operation(new Request(`${base}/portal/access`), contextWith([user]));
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { access: 'unavailable' });
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
    });
  }

  test('Given cancellation while the current name is loading, when its provider read settles, then the request stays cancelled', async () => {
    const pending = Promise.withResolvers<string>();
    const reading = Promise.withResolvers<void>();
    const operation = nameRead(() => { reading.resolve(); return pending.promise; });
    const cancellation = new AbortController();
    const response = operation(new Request(`${base}/portal/access`, { signal: cancellation.signal }), contextWith([user]));
    await reading.promise;
    cancellation.abort(new Error('cancelled'));
    pending.resolve('Acme Labs');
    await assert.rejects(response, /cancelled/);
  });

  test('Given cancellation while the billing plan is loading, when its read settles, then the request stays cancelled', async () => {
    const pending = Promise.withResolvers<{ organizationId: string; plan: 'team'; billedSeats: number }>();
    const reading = Promise.withResolvers<void>();
    const operation = portalAccessOperation(base, 'https://mcp.example/mcp', { organizationNameOf: async () => 'Acme Labs', billingOf: () => { reading.resolve(); return pending.promise; } });
    const cancellation = new AbortController();
    const response = operation(new Request(`${base}/portal/access`, { signal: cancellation.signal }), contextWith([user]));
    await reading.promise;
    cancellation.abort(new Error('cancelled'));
    pending.resolve({ organizationId: 'org_01ACME', plan: 'team', billedSeats: 0 });
    await assert.rejects(response, /cancelled/);
  });
});
