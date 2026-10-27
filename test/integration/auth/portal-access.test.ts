import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { BillingState } from '../../../src/accounts/billing/billing.ts';
import type { RoleGrant } from '../../../src/accounts/identity/access-context.ts';
import { portalAccessOperation } from '../../../src/interfaces/web/account/portal-access.ts';
import { portalBaseUrl as base, portalContext as contextWith, productUserGrant as user } from './fixtures/portal-access-context.ts';

const userManagerGrant: RoleGrant = { role: 'test-user-manager', permissions: ['user-grants:manage'] };
const member: RoleGrant = { role: 'member', permissions: [] };

const free = (organizationId: string): BillingState => ({ organizationId, plan: 'free', memberLimit: 5, billedSeats: 0 });

async function access(grants: readonly RoleGrant[], path = '/team/portal/access', method = 'GET', billingOf = async (organizationId: string) => free(organizationId)) {
  const operation = portalAccessOperation(base, 'https://mcp.example/service/mcp', { organizationNameOf: async () => 'Acme Labs', billingOf });
  return operation(new Request(`https://thermus.example${path}`, { method }), contextWith(grants));
}

describe('Product access of the portal with the real permission check', () => {
  test('Given User and synthetic user-manager grants, when the portal reads its product access, then it gets the organization and the roles that give a permission, without a highest role', async () => {
    const response = await access([userManagerGrant, user, member]);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { organizationId: 'org_01ACME', organizationName: 'Acme Labs', roles: ['test-user-manager', 'user'], plan: 'free', memberLimit: 5, mcpUrl: 'https://mcp.example/service/mcp' });
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  });

  test('Given the billing plan of the selected organization, when the portal reads its product access, then a free plan gives its member limit, a team plan gives none, and only the selected organization is read', async () => {
    const reads: string[] = [];
    const team = async (organizationId: string): Promise<BillingState> => { reads.push(organizationId); return { organizationId, plan: 'team', billedSeats: 4 }; };

    const response = await access([user], '/team/portal/access', 'GET', team);

    assert.deepEqual(await response.json(), { organizationId: 'org_01ACME', organizationName: 'Acme Labs', roles: ['user'], plan: 'team', mcpUrl: 'https://mcp.example/service/mcp' });
    assert.deepEqual(reads, ['org_01ACME']);
  });

  test('Given a billing read that fails, when the portal reads its product access, then the failure reaches the account routes and no product data is given', async () => {
    const outage = new Error('billing read timed out');

    await assert.rejects(access([user], '/team/portal/access', 'GET', async () => { throw outage; }), outage);
  });

  test('Given only a synthetic user-manager grant, only the default role, or no grant, when the portal reads its product access, then it gets 403 and no organization data', async () => {
    for (const grants of [[userManagerGrant], [member], []]) {
      const response = await access(grants);
      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { access: 'denied' });
    }
  });

  test('Given another path or method, when the operation gets it, then it answers 404 or 405 without product data', async () => {
    assert.equal((await access([user], '/team/portal')).status, 404);
    assert.equal((await access([user], '/teamevil/portal/access')).status, 404);
    const post = await access([user], '/team/portal/access', 'POST');
    assert.equal(post.status, 405);
    assert.equal(post.headers.get('Allow'), 'GET, HEAD');
  });
});
