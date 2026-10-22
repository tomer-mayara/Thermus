import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createRequestContext, type RoleGrant } from '../../../src/accounts/identity/access-context.ts';
import { portalAccessOperation } from '../../../src/interfaces/web/account/portal-access.ts';

const base = 'https://thermus.example/team';
const user: RoleGrant = { role: 'user', permissions: ['product:access'] };
const userManagerGrant: RoleGrant = { role: 'test-user-manager', permissions: ['user-grants:manage'] };
const member: RoleGrant = { role: 'member', permissions: [] };

function contextWith(grants: readonly RoleGrant[]) {
  return createRequestContext({
    user: { authority: 'workos:client_test', subject: 'user_01ADA', selectedOrganizationId: 'org_01ACME' },
    tenantId: 'workos:client_test:org_01ACME',
    organizationId: 'org_01ACME',
    grants,
  });
}

async function access(grants: readonly RoleGrant[], path = '/team/portal/access', method = 'GET') {
  const response = await portalAccessOperation(base, 'https://mcp.example/service/mcp', async () => 'Acme Labs')(new Request(`https://thermus.example${path}`, { method }), contextWith(grants));
  return { status: response.status, body: response.headers.get('Content-Type')?.includes('json') ? await response.json() : await response.text(), response };
}

describe('Product access of the portal with the real permission check', () => {
  test('Given User and synthetic user-manager grants, when the portal reads its product access, then it gets the organization and the roles that give a permission, without a highest role', async () => {
    const { status, body, response } = await access([userManagerGrant, user, member]);
    assert.equal(status, 200);
    assert.deepEqual(body, { organizationId: 'org_01ACME', organizationName: 'Acme Labs', roles: ['test-user-manager', 'user'], plan: 'free', mcpUrl: 'https://mcp.example/service/mcp' });
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  });

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
    let complete!: (name: string) => void;
    let started!: () => void;
    const reading = new Promise<void>((resolve) => { started = resolve; });
    const operation = portalAccessOperation(base, 'https://mcp.example/mcp', () => new Promise((resolve) => { complete = resolve; started(); }));
    const cancellation = new AbortController();
    const response = operation(new Request(`${base}/portal/access`, { signal: cancellation.signal }), contextWith([user]));
    await reading;
    cancellation.abort(new Error('cancelled'));
    complete('Acme Labs');
    await assert.rejects(response, /cancelled/);
  });

  test('Given only a synthetic user-manager grant, only the default role, or no grant, when the portal reads its product access, then it gets 403 and no organization data', async () => {
    for (const grants of [[userManagerGrant], [member], []]) {
      const { status, body } = await access(grants);
      assert.equal(status, 403);
      assert.deepEqual(body, { access: 'denied' });
    }
  });

  test('Given another path or method, when the operation gets it, then it answers 404 or 405 without product data', async () => {
    assert.equal((await access([user], '/team/portal')).status, 404);
    assert.equal((await access([user], '/teamevil/portal/access')).status, 404);
    const post = await access([user], '/team/portal/access', 'POST');
    assert.equal(post.status, 405);
    assert.equal(post.response.headers.get('Allow'), 'GET, HEAD');
  });
});
