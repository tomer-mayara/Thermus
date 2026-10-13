import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { formsIn } from '../../support/hosted-browser.ts';
import { accountRequest, ann, assertPage, ben, organization, publicOrigin, serve, signedIn } from './fixtures/account-routes-fixtures.ts';
import { annToken, serveAnn, sessionCookies } from './fixtures/organization-routes-fixtures.ts';

const pageHeaders = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'content-security-policy': "default-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
};

function headersWithoutCookies(response: Response): Record<string, string> {
  return Object.fromEntries([...response.headers].filter(([name]) => name !== 'set-cookie'));
}

describe('HostedAccountRoutes organization page', () => {
  for (const method of ['GET', 'HEAD']) {
    test(`Given a signed-in user with authorized organizations, when a ${method} request opens the organization page, then each organization has a selection form with the form token of the session, its ID, and the return destination, the selected one is marked, and the session cookies reach the page`, async () => {
      const { routes, organizations, resolver, operations } = serveAnn();

      const response = await routes.handle(accountRequest('/organizations?return_to=/administration/users', 'session=ann', { method }));
      const body = await response.text();

      assert.equal(response.status, 200);
      assert.deepEqual(headersWithoutCookies(response), pageHeaders);
      assert.deepEqual(response.headers.getSetCookie(), sessionCookies);
      assert.deepEqual(formsIn(body), [
        { action: '/organizations/select', fields: { csrf_token: annToken, organization_id: 'org-a', return_to: '/administration/users' }, label: 'Acme (selected)' },
        { action: '/organizations/select', fields: { csrf_token: annToken, organization_id: 'org-b', return_to: '/administration/users' }, label: 'Globex' },
      ]);
      assert.doesNotMatch(body, /<script|<link|<img|<style/i);
      assert.deepEqual(organizations.lists, [ann]);
      assert.deepEqual([resolver.calls, operations.calls], [[], []]);
    });
  }

  test('Given organization names and IDs with HTML characters, when the organization page opens, then the page shows them as text', async () => {
    const { routes } = serveAnn({}, { organizations: new Map([[ann.subject, [organization('org-"><script>x</script>', '<b>Acme & Sons</b> "Ltd" \'s')]]]) });

    const body = await (await routes.handle(accountRequest('/organizations', 'session=ann'))).text();

    assert.doesNotMatch(body, /<script>|<b>/);
    assert.deepEqual(formsIn(body).map(({ fields, label }) => [fields.organization_id, label]), [['org-"><script>x</script>', '<b>Acme & Sons</b> "Ltd" \'s']]);
  });

  for (const publicBaseUrl of ['https://thermus.example/team/', 'https://thermus.example/team']) {
    test(`Given the public URL ${publicBaseUrl} and no return destination, when the organization page opens, then each form posts under the public path and returns to the organization page there`, async () => {
      const { routes } = serveAnn({}, { publicBaseUrl });

      const body = await (await routes.handle(accountRequest('/team/organizations', 'session=ann'))).text();

      assert.deepEqual(formsIn(body).map(({ action, fields }) => [action, fields.return_to]), [
        ['/team/organizations/select', '/team/organizations'],
        ['/team/organizations/select', '/team/organizations'],
      ]);
    });
  }

  test('Given a signed-in user without an authorized organization, when the organization page opens, then it tells the user to accept an invitation or to contact the operator, has no form, and resolves no tenant access', async () => {
    const { routes, organizations, resolver, operations } = serve({ sessions: new Map([['session=ben', signedIn(ben, { cookies: sessionCookies })]]) });

    const response = await routes.handle(accountRequest('/organizations?organizationId=org-b', 'session=ben', { headers: { 'X-Organization-Id': 'org-b' } }));

    await assertPage(response.clone(), { status: 200, text: /accept the invitation/, cookies: sessionCookies });
    assert.match(await response.text(), /contact the operator/);
    assert.deepEqual(organizations.lists, [ben]);
    assert.deepEqual([resolver.calls, operations.calls], [[], []]);
  });

  for (const [label, query] of [
    ['an absolute URL', 'return_to=https://evil.example/'],
    ['a URL without a scheme', 'return_to=//evil.example/'],
    ['a path with a backslash', 'return_to=/\\evil.example/'],
    ['a relative path', 'return_to=administration/users'],
    ['a path outside the public path', 'return_to=/other/'],
    ['a path that only starts like the public path', 'return_to=/teamevil/'],
    ['dot segments', 'return_to=/team/../other/'],
    ['encoded dot segments', 'return_to=/team/%2e%2e/other/'],
    ['a query', 'return_to=/team/account?organizationId=org-b'],
    ['a fragment', 'return_to=/team/account%23top'],
    ['a control character', 'return_to=/team/account%0d%0aSet-Cookie:%20x=1'],
    ['a space', 'return_to=/team/my%20account'],
    ['an empty value', 'return_to='],
    ['a very long path', `return_to=/team/${'a'.repeat(2_048)}`],
    ['two values', 'return_to=/team/account&return_to=/team/billing'],
  ] as const) {
    test(`Given a return destination with ${label}, when the organization page opens, then it gets 400 with the session cookies and lists no organization`, async () => {
      const { routes, organizations } = serveAnn({}, { publicBaseUrl: 'https://thermus.example/team' });

      const response = await routes.handle(accountRequest(`/team/organizations?${query}`, 'session=ann'));

      await assertPage(response, { status: 400, text: /The request is not valid\./, cookies: sessionCookies });
      assert.deepEqual(organizations.lists, []);
    });
  }

  for (const method of ['POST', 'PUT', 'DELETE']) {
    test(`Given a ${method} request, when it reaches the organization page, then it gets 405 with Allow: GET, HEAD and the session cookies, and no organization is listed`, async () => {
      const { routes, organizations } = serveAnn();

      const response = await routes.handle(accountRequest('/organizations', 'session=ann', { method, headers: { Origin: publicOrigin } }));

      assert.equal(response.headers.get('Allow'), 'GET, HEAD');
      await assertPage(response, { status: 405, text: /This page does not accept this request method\./, cookies: sessionCookies });
      assert.deepEqual(organizations.lists, []);
    });
  }

  test('Given a failed organization list, when the organization page opens, then it gets the failure page with the session cookies, and the operator gets the path and the cause', async () => {
    const outage = new Error('organization directory timed out');
    const { routes, failures } = serveAnn({}, { organizations: new Map([[ann.subject, outage]]) });

    await assertPage(await routes.handle(accountRequest('/organizations', 'session=ann')), { status: 500, text: /The request failed\. Try again later\./, cookies: sessionCookies });

    assert.deepEqual(failures, [{ path: '/organizations', cause: outage }]);
  });
});
