import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formsIn } from '../../support/drivers/browser/hosted-browser.ts';
import { accountRequest } from './fixtures/account-routes-fixtures.ts';
import { acmeMembers, annToken, changePost, serveAdministration, sessionCookies } from './fixtures/administration-routes-fixtures.ts';

test('Given a currently authorized session and a valid legacy grant form, when the retired path receives it, then no service write runs and the response is unavailable with session cookies', async () => {
  const { routes, organizations } = serveAdministration({}, { routes: { withOperation: false } });

  const response = await routes.handle(changePost('/members/grants', {
    csrf_token: annToken, organization_id: 'org-a', membership_id: 'membership-dora', revision: 'r2', role: 'user', action: 'grant',
  }));

  assert.deepEqual({ status: response.status, calls: organizations.administrationCalls }, { status: 404, calls: [] });
  assert.deepEqual(response.headers.getSetCookie(), sessionCookies);
});

test('Given current member data, when Members opens, then member details remain visible without grant forms', async () => {
  const { routes } = serveAdministration({ members: acmeMembers });

  const response = await routes.handle(accountRequest('/members', 'session=ann'));
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /ann@example\.com: active\. Roles: User, Admin\./);
  assert.deepEqual(formsIn(body), []);
});
