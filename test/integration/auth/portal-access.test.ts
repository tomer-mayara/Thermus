import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createRequestContext, type RoleGrant } from '../../../src/auth/access-context.ts';
import { portalAccessOperation } from '../../../src/hosted-admin/portal-access.ts';

const base = 'https://thermus.example/team';
const user: RoleGrant = { role: 'user', permissions: ['product:access'] };
const admin: RoleGrant = { role: 'admin', permissions: ['user-grants:manage'] };
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
  const response = await portalAccessOperation(base)(new Request(`https://thermus.example${path}`, { method }), contextWith(grants));
  return { status: response.status, body: response.headers.get('Content-Type')?.includes('json') ? await response.json() : await response.text(), response };
}

describe('Product access of the portal with the real permission check', () => {
  test('Given User and Admin grants, when the portal reads its product access, then it gets the organization and the roles that give a permission, without a highest role', async () => {
    const { status, body, response } = await access([admin, user, member]);
    assert.equal(status, 200);
    assert.deepEqual(body, { organizationId: 'org_01ACME', roles: ['admin', 'user'] });
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  });

  test('Given only Admin, or only the default role, when the portal reads its product access, then it gets 403 and no organization data', async () => {
    for (const grants of [[admin], [member], []]) {
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
