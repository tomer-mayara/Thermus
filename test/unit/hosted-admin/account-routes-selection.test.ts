import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { OrganizationSwitch } from '../../../src/auth/hosted-auth/browser-session.ts';
import { accountRequest, ann, assertPage, formPost, postForm, publicOrigin, serve } from './fixtures/account-routes-fixtures.ts';
import { annOrganizations, selection, serveAnn, sessionCookies, switchCookies, validSelection } from './fixtures/organization-routes-fixtures.ts';

describe('HostedAccountRoutes organization selection', () => {
  test('Given a same-origin form post with the session form token, an authorized organization, and a return destination, when it arrives, then the session switches to that organization, and the browser gets 303 to the destination with the session cookies and then the switch cookies', async () => {
    const { routes, annSession, organizations, resolver } = serveAnn({ switchTo: { status: 'switched', cookies: switchCookies } });

    const response = await routes.handle(selection(validSelection, { 'X-Organization-Id': 'org-c' }));

    assert.equal(response.status, 303);
    assert.equal(response.headers.get('Location'), 'https://magumagu.example/administration/users');
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(response.headers.getSetCookie(), [...sessionCookies, ...switchCookies]);
    assert.equal(await response.text(), '');
    assert.deepEqual(organizations.selections, [{ user: ann, organizationId: 'org-b' }]);
    assert.deepEqual(annSession.switches, ['org-b']);
    assert.deepEqual(resolver.calls, []);
  });

  test('Given a public URL under a path, when a selection names a destination under that path, then the redirect goes to that destination on the public origin', async () => {
    const { routes } = serveAnn({}, { publicBaseUrl: 'https://magumagu.example/team/' });

    const response = await routes.handle(formPost('/team/organizations/select', 'session=ann', new URLSearchParams({ ...validSelection, return_to: '/team/billing' }).toString()));

    assert.equal(response.headers.get('Location'), 'https://magumagu.example/team/billing');
  });

  for (const [label, organizationId] of [['an organization of another user', 'org-z'], ['an inactive or unknown organization', 'org-c']] as const) {
    test(`Given a valid selection post for ${label}, also with forged organization values in the query and headers, when the service refuses it, then it gets 403 with the session cookies, and the session does not switch`, async () => {
      const { routes, annSession, organizations } = serveAnn();
      const body = new URLSearchParams({ ...validSelection, organization_id: organizationId }).toString();
      const request = postForm('/organizations/select?organizationId=org-b', { cookie: 'session=ann', body, headers: { 'X-Organization-Id': 'org-b' } });

      await assertPage(await routes.handle(request), { status: 403, text: /Your account has no access to this organization\./, cookies: sessionCookies });

      assert.deepEqual(organizations.selections, [{ user: ann, organizationId }]);
      assert.deepEqual(annSession.switches, []);
    });
  }

  for (const [label, outcome, status, text] of [
    ['refused', { status: 'refused', cookies: switchCookies }, 403, /Your account has no access to this organization\./],
    ['signed out', { status: 'signed-out', cookies: switchCookies }, 401, /Sign in to use this page\./],
  ] as const satisfies ReadonlyArray<readonly [string, OrganizationSwitch, number, RegExp]>) {
    test(`Given a session that is ${label} at the switch, when a valid selection post arrives, then it gets ${status} with the session cookies and then the switch cookies, and no redirect`, async () => {
      const { routes, annSession } = serveAnn({ switchTo: outcome });

      await assertPage(await routes.handle(selection(validSelection)), { status, text, cookies: [...sessionCookies, ...switchCookies] });

      assert.deepEqual(annSession.switches, ['org-b']);
    });
  }

  for (const failure of ['organization check', 'switch'] as const) {
    test(`Given a failed ${failure}, when a valid selection post arrives, then it gets the failure page with the session cookies and no redirect, and the operator gets the path and the cause`, async () => {
      const outage = new Error(`${failure} timed out`);
      const { routes, annSession, failures } = serveAnn(
        failure === 'switch' ? { switchTo: outage } : {},
        failure === 'switch' ? {} : { organizations: new Map([[ann.subject, outage]]) },
      );

      await assertPage(await routes.handle(selection(validSelection)), { status: 500, text: /The request failed\. Try again later\./, cookies: sessionCookies });

      assert.deepEqual(failures, [{ path: '/organizations/select', cause: outage }]);
      assert.deepEqual(annSession.switches, failure === 'switch' ? ['org-b'] : []);
    });
  }

  for (const method of ['GET', 'PUT']) {
    test(`Given a ${method} request, when it reaches the selection route, then it gets 405 with Allow: POST, and no organization is checked or switched`, async () => {
      const { routes, annSession, organizations } = serveAnn();

      const response = await routes.handle(accountRequest('/organizations/select', 'session=ann', { method, headers: { Origin: publicOrigin } }));

      assert.equal(response.headers.get('Allow'), 'POST');
      await assertPage(response, { status: 405, text: /This page does not accept this request method\./, cookies: sessionCookies });
      assert.deepEqual([organizations.selections, annSession.switches], [[], []]);
    });
  }

  test('Given an unavailable or signed-out session, when the organization page or a selection post arrives, then no organization is listed, checked, or switched', async () => {
    const unavailable = serve({ otherSession: { status: 'unavailable' }, organizations: new Map([[ann.subject, annOrganizations]]) });
    const signedOut = serve({ organizations: new Map([[ann.subject, annOrganizations]]) });

    for (const { routes, organizations } of [unavailable, signedOut]) {
      const page = await routes.handle(accountRequest('/organizations', 'session=forged'));
      const post = await routes.handle(formPost('/organizations/select', 'session=forged', new URLSearchParams(validSelection).toString()));
      assert.deepEqual([page.status, post.status], routes === unavailable.routes ? [503, 503] : [401, 401]);
      assert.deepEqual([organizations.lists, organizations.selections], [[], []]);
    }
  });
});
