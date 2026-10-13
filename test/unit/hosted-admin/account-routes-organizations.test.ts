import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { OrganizationSwitch } from '../../../src/hosted-admin/browser-session.ts';
import { formsIn } from '../../support/hosted-browser.ts';
import {
  accountRequest,
  ann,
  assertPage,
  ben,
  formPost,
  organization,
  postForm,
  publicOrigin,
  serve,
  signedIn,
  type Setup,
} from './fixtures/account-routes-fixtures.ts';
import type { SignedInSetup } from './fixtures/browser-session-double.ts';

const sessionCookies = ['session=refreshed; Path=/; Secure; HttpOnly; SameSite=Lax'];
const switchCookies = ['session=switched; Path=/; Secure; HttpOnly; SameSite=Lax'];
const annToken = 'csrf-token-of-user-ann';
const annOrganizations = [organization('org-a', 'Acme', true), organization('org-b', 'Globex')];
const validSelection = { csrf_token: annToken, organization_id: 'org-b', return_to: '/administration/users' };
const listHeaders = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'content-security-policy': "default-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
};

function serveAnn(session: SignedInSetup = {}, setup: Setup = {}) {
  const annSession = signedIn(ann, { cookies: sessionCookies, ...session });
  const served = serve({ sessions: new Map([['session=ann', annSession]]), organizations: new Map([[ann.subject, annOrganizations]]), ...setup });
  return { ...served, annSession };
}

function selection(fields: Readonly<Record<string, string>> | string, headers: Readonly<Record<string, string>> = {}): Request {
  const body = typeof fields === 'string' ? fields : new URLSearchParams(fields).toString();
  return postForm('/organizations/select', { cookie: 'session=ann', body, headers });
}

function headersWithoutCookies(response: Response): Record<string, string> {
  return Object.fromEntries([...response.headers].filter(([name]) => name !== 'set-cookie'));
}

describe('HostedAccountRoutes organization page', () => {
  test('Given a signed-in user with authorized organizations, when the organization page opens, then each organization has a selection form with the form token of the session, its ID, and the return destination, the selected one is marked, and the session cookies reach the page', async () => {
    const { routes, organizations, resolver, operations } = serveAnn();

    const response = await routes.handle(accountRequest('/organizations?return_to=/administration/users', 'session=ann'));
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.deepEqual(headersWithoutCookies(response), listHeaders);
    assert.deepEqual(response.headers.getSetCookie(), sessionCookies);
    assert.deepEqual(formsIn(body), [
      { action: '/organizations/select', fields: { csrf_token: annToken, organization_id: 'org-a', return_to: '/administration/users' }, label: 'Acme (selected)' },
      { action: '/organizations/select', fields: { csrf_token: annToken, organization_id: 'org-b', return_to: '/administration/users' }, label: 'Globex' },
    ]);
    assert.doesNotMatch(body, /<script|<link|<img|<style/i);
    assert.deepEqual(organizations.lists, [ann]);
    assert.deepEqual([resolver.calls, operations.calls], [[], []]);
  });

  test('Given organization names and IDs with HTML characters, when the organization page opens, then the page shows them as text', async () => {
    const { routes } = serveAnn({}, { organizations: new Map([[ann.subject, [organization('org-"><script>x</script>', '<b>Acme & Sons</b> "Ltd" \'s')]]]) });

    const body = await (await routes.handle(accountRequest('/organizations', 'session=ann'))).text();

    assert.doesNotMatch(body, /<script>|<b>/);
    assert.deepEqual(formsIn(body).map(({ fields, label }) => [fields.organization_id, label]), [['org-"><script>x</script>', '<b>Acme & Sons</b> "Ltd" \'s']]);
  });

  test('Given no return destination, when the organization page opens, then each form returns to the organization page under the public path', async () => {
    const { routes } = serveAnn({}, { publicBaseUrl: 'https://magumagu.example/team/' });

    const body = await (await routes.handle(accountRequest('/team/organizations', 'session=ann'))).text();

    assert.deepEqual(formsIn(body).map(({ action, fields }) => [action, fields.return_to]), [
      ['/team/organizations/select', '/team/organizations'],
      ['/team/organizations/select', '/team/organizations'],
    ]);
  });

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
      const { routes, organizations } = serveAnn({}, { publicBaseUrl: 'https://magumagu.example/team/' });

      const response = await routes.handle(accountRequest(`/team/organizations?${query}`, 'session=ann'));

      await assertPage(response, { status: 400, text: /The request is not valid\./, cookies: sessionCookies });
      assert.deepEqual(organizations.lists, []);
    });
  }

  for (const method of ['POST', 'PUT', 'DELETE', 'HEAD']) {
    test(`Given a ${method} request, when it reaches the organization page, then it gets 405 with Allow: GET and the session cookies, and no organization is listed`, async () => {
      const { routes, organizations } = serveAnn();

      const response = await routes.handle(accountRequest('/organizations', 'session=ann', { method, headers: { Origin: publicOrigin } }));

      assert.equal(response.headers.get('Allow'), 'GET');
      await assertPage(response, { status: 405, text: /This page does not accept this request method\./, cookies: sessionCookies });
      assert.deepEqual(organizations.lists, []);
    });
  }
});

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

  for (const [label, origin] of [['a foreign origin', 'https://evil.example'], ['a null origin', 'null'], ['another scheme', 'http://magumagu.example'], ['another port', 'https://magumagu.example:8443'], ['no origin', undefined]] as const) {
    test(`Given a selection post with ${label}, when it arrives, then it gets 403 with the session cookies, its body stays unread, and no organization is checked or switched`, async () => {
      const { routes, annSession, organizations } = serveAnn();
      const request = accountRequest('/organizations/select', 'session=ann', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(origin === undefined ? {} : { Origin: origin }) },
        body: new URLSearchParams(validSelection).toString(),
      });

      await assertPage(await routes.handle(request), { status: 403, text: /The form is not from this site or is no longer valid\./, cookies: sessionCookies });

      assert.equal(request.bodyUsed, false);
      assert.deepEqual([organizations.selections, annSession.switches], [[], []]);
    });
  }

  for (const [label, fields] of [
    ['no form token', `organization_id=org-b&return_to=/administration/users`],
    ['an empty form token', `csrf_token=&organization_id=org-b&return_to=/administration/users`],
    ['the form token of another session', `csrf_token=csrf-token-of-user-ben&organization_id=org-b&return_to=/administration/users`],
    ['a longer form token', `csrf_token=${annToken}x&organization_id=org-b&return_to=/administration/users`],
    ['two form tokens', `csrf_token=${annToken}&csrf_token=${annToken}&organization_id=org-b&return_to=/administration/users`],
  ] as const) {
    test(`Given a selection post with ${label}, when it arrives, then it gets 403 with the session cookies, and no organization is checked or switched`, async () => {
      const { routes, annSession, organizations } = serveAnn();

      await assertPage(await routes.handle(selection(fields)), { status: 403, text: /The form is not from this site or is no longer valid\./, cookies: sessionCookies });

      assert.deepEqual([organizations.selections, annSession.switches], [[], []]);
    });
  }

  test('Given a session without a form token, when a selection post sends an empty token, then the post is refused', async () => {
    const { routes, annSession, organizations } = serveAnn({ csrfToken: '' });

    await assertPage(await routes.handle(selection({ ...validSelection, csrf_token: '' })), { status: 403, text: /no longer valid/, cookies: sessionCookies });

    assert.deepEqual([organizations.selections, annSession.switches], [[], []]);
  });

  for (const [label, fields] of [
    ['no organization', `csrf_token=${annToken}&return_to=/administration/users`],
    ['an empty organization', `csrf_token=${annToken}&organization_id=&return_to=/administration/users`],
    ['two organizations', `csrf_token=${annToken}&organization_id=org-a&organization_id=org-b&return_to=/administration/users`],
    ['an organization with a space', `csrf_token=${annToken}&organization_id=org%20b&return_to=/administration/users`],
    ['an organization with a control character', `csrf_token=${annToken}&organization_id=org-b%0a&return_to=/administration/users`],
    ['a very long organization', `csrf_token=${annToken}&organization_id=${'o'.repeat(257)}&return_to=/administration/users`],
    ['no return destination', `csrf_token=${annToken}&organization_id=org-b`],
    ['two return destinations', `csrf_token=${annToken}&organization_id=org-b&return_to=/account&return_to=/billing`],
    ['an absolute return destination', `csrf_token=${annToken}&organization_id=org-b&return_to=https://evil.example/`],
    ['a return destination for another host', `csrf_token=${annToken}&organization_id=org-b&return_to=//evil.example/`],
    ['a return destination with dot segments', `csrf_token=${annToken}&organization_id=org-b&return_to=/a/../../evil`],
    ['an organization name', `csrf_token=${annToken}&organization_id=org-b&return_to=/account&organization_name=Renamed`],
    ['an unknown field', `csrf_token=${annToken}&organization_id=org-b&return_to=/account&role=admin`],
  ] as const) {
    test(`Given a selection post with ${label}, when it arrives, then it gets 400 with the session cookies, and no organization is checked or switched`, async () => {
      const { routes, annSession, organizations } = serveAnn();

      await assertPage(await routes.handle(selection(fields)), { status: 400, text: /The request is not valid\./, cookies: sessionCookies });

      assert.deepEqual([organizations.selections, annSession.switches], [[], []]);
    });
  }

  for (const [label, contentType, status, text] of [
    ['JSON', 'application/json', 415, /This page accepts only HTML form data\./],
    ['multipart form data', 'multipart/form-data; boundary=x', 415, /This page accepts only HTML form data\./],
  ] as const) {
    test(`Given a selection post with ${label}, when it arrives, then it gets ${status}, and no organization is checked or switched`, async () => {
      const { routes, annSession, organizations } = serveAnn();

      await assertPage(await routes.handle(selection(JSON.stringify(validSelection), { 'Content-Type': contentType })), { status, text, cookies: sessionCookies });

      assert.deepEqual([organizations.selections, annSession.switches], [[], []]);
    });
  }

  test('Given selection posts larger than 16 KiB, with and without a Content-Length, when they arrive, then each gets 413, and no organization is checked or switched', async () => {
    const { routes, annSession, organizations } = serveAnn();
    const large = `${new URLSearchParams(validSelection).toString()}&padding=${'x'.repeat(16 * 1024)}`;
    const streamed = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(large));
        controller.close();
      },
    });

    await assertPage(await routes.handle(selection(large, { 'Content-Length': String(large.length) })), { status: 413, text: /The form data is too large\./, cookies: sessionCookies });
    await assertPage(await routes.handle(accountRequest('/organizations/select', 'session=ann', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: publicOrigin },
      body: streamed,
      duplex: 'half',
    } as RequestInit)), { status: 413, text: /The form data is too large\./, cookies: sessionCookies });

    assert.deepEqual([organizations.selections, annSession.switches], [[], []]);
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

  test('Given a failed organization list, when the organization page opens, then it gets the failure page with the session cookies, and the operator gets the path and the cause', async () => {
    const outage = new Error('organization directory timed out');
    const { routes, failures } = serveAnn({}, { organizations: new Map([[ann.subject, outage]]) });

    await assertPage(await routes.handle(accountRequest('/organizations', 'session=ann')), { status: 500, text: /The request failed\. Try again later\./, cookies: sessionCookies });

    assert.deepEqual(failures, [{ path: '/organizations', cause: outage }]);
  });

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
