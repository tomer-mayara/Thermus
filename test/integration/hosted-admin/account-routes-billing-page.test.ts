import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { BillingState } from '../../../src/accounts/billing/billing.ts';
import { accountRequest, ann, assertPage, publicOrigin } from './fixtures/account-routes-fixtures.ts';
import { serveAdministration, sessionCookies } from './fixtures/administration-routes-fixtures.ts';

const freeState: BillingState = { organizationId: 'org-a', plan: 'free', billedSeats: 0 };
const freePage = [
  '<h1>Billing</h1>',
  '<p>Plan: Free</p>',
  '<p>Billed seats: 0</p>',
  '<p>This service collects no payment. The organization is on the free plan, and no seat is billed. Access depends only on the grants of each member.</p>',
];
const accessDenial = /<a href="\/organizations">organization page<\/a>/;

function mainOf(body: string): readonly string[] {
  return /<main>\n([\s\S]*)\n<\/main>/.exec(body)?.[1]?.split('\n') ?? [];
}

describe('HostedAccountRoutes billing page', () => {
  for (const method of ['GET', 'HEAD']) {
    test(`Given allowed access and the free billing state, when a ${method} request opens the billing page with forged organization values in the query and the headers, then the service gets the user and organization of the decided context, and the page shows only the free plan, no billed seat, and the payment text, without a form, with the notice headers and the session cookies`, async () => {
      const { routes, organizations, resolver } = serveAdministration({ billing: freeState });

      const response = await routes.handle(accountRequest('/billing?organizationId=org-b&organization_id=org-b', 'session=ann', { method, headers: { 'X-Organization-Id': 'org-b' } }));
      const body = await response.clone().text();

      await assertPage(response, { status: 200, text: /<title>Billing<\/title>/, cookies: sessionCookies });
      assert.deepEqual(mainOf(body), freePage);
      assert.deepEqual(organizations.administrationCalls, [{ operation: 'billingState', actor: { user: ann }, request: 'org-a' }]);
      assert.deepEqual(resolver.calls, [ann]);
    });
  }

  for (const method of ['POST', 'PUT', 'DELETE']) {
    test(`Given a ${method} request with a form from this site, when it reaches the billing page, then it gets 405 with Allow: GET, HEAD and the session cookies, and the service is not asked, because the free plan has no billing change`, async () => {
      const { routes, organizations } = serveAdministration({ billing: freeState });
      const init = { method, headers: { Origin: publicOrigin, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'organization_id=org-a&seat_count=5' };

      const response = await routes.handle(accountRequest('/billing', 'session=ann', init));

      assert.equal(response.headers.get('Allow'), 'GET, HEAD');
      await assertPage(response, { status: 405, text: /This page does not accept this request method\./, cookies: sessionCookies });
      assert.deepEqual(organizations.administrationCalls, []);
    });
  }

  test('Given a service that denies the actor, when the billing page opens, then it gets the 403 access denial with a link to the organization page and the session cookies, and no billing state', async () => {
    const { routes } = serveAdministration({ billing: 'denied' });

    const response = await routes.handle(accountRequest('/billing', 'session=ann'));
    const body = await response.clone().text();

    await assertPage(response, { status: 403, text: accessDenial, cookies: sessionCookies });
    assert.doesNotMatch(body, /Plan:|Billed seats/);
  });

  test('Given a session without MFA and allowed current access, when the billing page opens, then it shows the existing free state with the session cookies', async () => {
    const { routes, organizations } = serveAdministration({ billing: freeState }, { session: { mfaCompleted: false } });

    const response = await routes.handle(accountRequest('/billing', 'session=ann'));

    await assertPage(response, { status: 200, text: /Plan: Free/, cookies: sessionCookies });
    assert.deepEqual(organizations.administrationCalls, [{ operation: 'billingState', actor: { user: ann }, request: 'org-a' }]);
  });

  test('Given a decided context without an organization, when the billing page opens, then it gets the 403 access denial, and the service is not asked', async () => {
    const { routes, organizations } = serveAdministration({ billing: freeState }, {
      routes: { decisions: new Map([[ann.subject, { allowed: true, context: { user: ann, tenantId: 'local:installation', grants: [], permissions: [] } }]]) },
    });

    const response = await routes.handle(accountRequest('/billing', 'session=ann'));

    await assertPage(response, { status: 403, text: accessDenial, cookies: sessionCookies });
    assert.deepEqual(organizations.administrationCalls, []);
  });

  test('Given a billing read that fails, when the billing page opens, then it gets the failure page with the session cookies, and the operator gets the path and the cause', async () => {
    const outage = new Error('billing read timed out');
    const { routes, failures } = serveAdministration({ billing: outage });

    const response = await routes.handle(accountRequest('/billing', 'session=ann'));

    await assertPage(response, { status: 500, text: /The request failed\. Try again later\./, cookies: sessionCookies });
    assert.deepEqual(failures, [{ path: '/billing', cause: outage }]);
  });
});
