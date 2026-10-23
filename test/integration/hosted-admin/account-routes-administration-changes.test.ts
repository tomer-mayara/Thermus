import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { UnconfirmedChangeError, type ChangeResult } from '../../../src/accounts/organizations/change-records.ts';
import { formsIn } from '../../support/drivers/browser/hosted-browser.ts';
import { ann, assertPage, postForm } from './fixtures/account-routes-fixtures.ts';
import { annToken, changePost, serveAdministration, sessionCookies, validChanges } from './fixtures/administration-routes-fixtures.ts';

const changes = Object.entries(validChanges);

describe('HostedAccountRoutes invitation changes', () => {
  test('Given an invitation address already in use, when the native send is refused, then the notice explains the conflict without offering retired member role controls', async () => {
    const { routes } = serveAdministration({ change: 'address-in-use' });

    const response = await routes.handle(changePost(validChanges.send.path, validChanges.send.fields));
    const body = await response.text();

    assert.equal(response.status, 409);
    assert.match(body, /already belongs to a member.*pending invitation/);
    assert.match(body, /An existing member cannot be invited again\. To replace a pending invitation, revoke it first\./);
    assert.doesNotMatch(body, /To change the roles|open the members page/);
  });

  for (const [name, { path, fields }] of changes) {
    for (const outcome of ['applied', 'unchanged'] as const) {
      test(`Given a valid ${name} post from this site, when the service answers ${outcome}, then the service gets the decided actor and only the fields of the change, and the browser gets 303 to the page with the session cookies`, async () => {
        const { routes, organizations, resolver } = serveAdministration({ change: outcome });

        const response = await routes.handle(changePost(path, fields, { 'X-Organization-Id': 'org-b' }));

        assert.equal(response.status, 303);
        assert.equal(response.headers.get('Location'), `https://thermus.example/members`);
        assert.equal(response.headers.get('Cache-Control'), 'no-store');
        assert.deepEqual(response.headers.getSetCookie(), sessionCookies);
        assert.equal(await response.text(), '');
        const [call] = organizations.administrationCalls;
        assert.deepEqual(call?.actor, { user: ann });
        assert.doesNotMatch(JSON.stringify(call), new RegExp(`${annToken}|session=`));
        assert.deepEqual(resolver.calls, [ann]);
      });
    }
  }

  test('Given a session without MFA and allowed current access, when each valid change is posted, then the change succeeds with the session cookies and the decided actor', async () => {
    const { routes, organizations } = serveAdministration({ change: 'applied' }, { session: { mfaCompleted: false } });

    for (const [, { path, fields }] of changes) {
      const response = await routes.handle(changePost(path, fields));
      assert.equal(response.status, 303);
      assert.deepEqual(response.headers.getSetCookie(), sessionCookies);
    }

    assert.deepEqual(organizations.administrationCalls.map(({ actor }) => actor), changes.map(() => ({ user: ann })));
  });

  test('Given valid posts, when they reach the service, then each change gets exactly the fields of its form', async () => {
    const { routes, organizations } = serveAdministration();

    for (const [, { path, fields }] of changes) await routes.handle(changePost(path, fields));

    assert.deepEqual(organizations.administrationCalls.map(({ operation, request }) => [operation, request]), [
      ['sendInvitation', { organizationId: 'org-a', role: 'user', email: 'new.user@example.com' }],
      ['resendInvitation', { organizationId: 'org-a', invitationId: 'invitation-1' }],
      ['revokeInvitation', { organizationId: 'org-a', invitationId: 'invitation-1' }],
    ]);
  });

  for (const [outcome, status, text] of [
    ['denied', 403, /Your account cannot make this change in the selected organization\. Nothing changed\./],
    ['stale', 409, /changed after the page was shown\. Nothing changed\./],
    ['not-pending', 409, /The invitation is no longer pending/],
    ['address-in-use', 409, /This email address already belongs to a member of the organization, or it has a pending invitation\. Nothing changed\./],
    ['unsupported', 503, /The account directory cannot make this change safely now\. Nothing changed\./],
  ] as const satisfies ReadonlyArray<readonly [ChangeResult, number, RegExp]>) {
    test(`Given a service that answers ${outcome}, when each change is posted, then it gets ${status} with its notice and the session cookies, and no redirect`, async () => {
      const { routes } = serveAdministration({ change: outcome });

      for (const [, { path, fields }] of changes) await assertPage(await routes.handle(changePost(path, fields)), { status, text, cookies: sessionCookies });
    });
  }

  test('Given a change that fails in the service, when it is posted, then it gets the failure page with the session cookies and no redirect, and the operator gets the path and the cause', async () => {
    const outage = new Error('directory change timed out');
    const { routes, failures } = serveAdministration({ change: outage });

    for (const [, { path, fields }] of changes) {
      await assertPage(await routes.handle(changePost(path, fields)), { status: 500, text: /The request failed\. Try again later\./, cookies: sessionCookies });
    }

    assert.deepEqual(failures, changes.map(([, { path }]) => ({ path, cause: outage })));
  });

  test('Given an unconfirmed write, when any invitation form is posted, then the only next action is a safe status read', async () => {
    const { routes, failures } = serveAdministration({ change: new UnconfirmedChangeError(new Error('secret-token provider detail')) });
    for (const [, { path, fields }] of changes) {
      const response = await routes.handle(changePost(path, fields));
      const body = await response.text();
      assert.equal(response.status, 503);
      assert.deepEqual(response.headers.getSetCookie(), sessionCookies);
      assert.match(body, /href="\/members">Check status<\/a>/);
      assert.match(body, /A pending invitation does not confirm email delivery/);
      assert.deepEqual(formsIn(body), []);
      assert.doesNotMatch(body, /secret-token|Nothing changed|Try again|Retry/);
    }
    assert.deepEqual(failures, []);
  });

  test('Given a signed-out session or access that the resolver denies, when a change is posted, then it gets 401 or 403 before any form check, and the service is not asked', async () => {
    const signedOut = serveAdministration();
    const denied = serveAdministration({}, { routes: { decisions: new Map([[ann.subject, { allowed: false, reason: 'permission-required' }]]) } });

    const answers = [
      await signedOut.routes.handle(postForm(validChanges.send.path, { cookie: 'session=ended', body: new URLSearchParams(validChanges.send.fields).toString() })),
      await denied.routes.handle(changePost(validChanges.send.path, validChanges.send.fields)),
    ];

    assert.deepEqual(answers.map(({ status }) => status), [401, 403]);
    assert.deepEqual([signedOut.organizations.administrationCalls, denied.organizations.administrationCalls], [[], []]);
  });
});
