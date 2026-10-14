import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { ChangeResult } from '../../../src/organizations/change-records.ts';
import { ann, assertPage, postForm } from './fixtures/account-routes-fixtures.ts';
import { annToken, changePost, serveAdministration, sessionCookies, validChanges } from './fixtures/administration-routes-fixtures.ts';

const changes = Object.entries(validChanges);

describe('HostedAccountRoutes grant and invitation changes', () => {
  for (const [name, { path, fields }] of changes) {
    for (const outcome of ['applied', 'unchanged'] as const) {
      test(`Given a valid ${name} post from this site, when the service answers ${outcome}, then the service gets the actor with the MFA evidence of the session and only the fields of the change, and the browser gets 303 to the page with the session cookies`, async () => {
        const { routes, organizations, resolver } = serveAdministration({ change: outcome });

        const response = await routes.handle(changePost(path, fields, { 'X-Organization-Id': 'org-b' }));

        assert.equal(response.status, 303);
        assert.equal(response.headers.get('Location'), `https://thermus.example${name === 'grant' ? '/members' : '/invitations'}`);
        assert.equal(response.headers.get('Cache-Control'), 'no-store');
        assert.deepEqual(response.headers.getSetCookie(), sessionCookies);
        assert.equal(await response.text(), '');
        const [call] = organizations.administrationCalls;
        assert.deepEqual(call?.actor, { user: ann, mfaCompleted: true });
        assert.doesNotMatch(JSON.stringify(call), new RegExp(`${annToken}|session=`));
        assert.deepEqual(resolver.calls, [ann]);
      });
    }
  }

  test('Given a session whose sign-in did not complete MFA, when each change is posted and the service requires MFA, then the service gets that evidence, and each post gets the MFA notice with the session cookies', async () => {
    const { routes, organizations } = serveAdministration({ change: 'mfa-required' }, { session: { mfaCompleted: false } });

    for (const [, { path, fields }] of changes) {
      await assertPage(await routes.handle(changePost(path, fields)), { status: 403, text: /Administration needs a sign-in that completed multi-factor authentication\./, cookies: sessionCookies });
    }

    assert.deepEqual(organizations.administrationCalls.map(({ actor }) => actor), changes.map(() => ({ user: ann, mfaCompleted: false })));
  });

  test('Given valid posts, when they reach the service, then each change gets exactly the fields of its form', async () => {
    const { routes, organizations } = serveAdministration();

    for (const [, { path, fields }] of changes) await routes.handle(changePost(path, fields));

    assert.deepEqual(organizations.administrationCalls.map(({ operation, request }) => [operation, request]), [
      ['changeGrant', { organizationId: 'org-a', membershipId: 'membership-dora', revision: 'r2', role: 'user', action: 'grant' }],
      ['sendInvitation', { organizationId: 'org-a', role: 'user', email: 'new.user@example.com' }],
      ['resendInvitation', { organizationId: 'org-a', invitationId: 'invitation-1' }],
      ['revokeInvitation', { organizationId: 'org-a', invitationId: 'invitation-1' }],
    ]);
  });

  for (const [outcome, status, text] of [
    ['denied', 403, /Your account cannot make this change in the selected organization\. Nothing changed\./],
    ['mfa-required', 403, /Administration needs a sign-in that completed multi-factor authentication\./],
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

  test('Given forged roles and actions, also for Super Admin, account disable, membership deactivation, and a credential reset, when they are posted, then the routes give them to the service unchanged, and the denial of the service refuses them', async () => {
    const { routes, organizations } = serveAdministration({ change: 'denied' });
    const forged = [
      { role: 'super-admin', action: 'grant' },
      { role: 'admin', action: 'revoke' },
      { role: 'user', action: 'deactivate' },
      { role: 'user', action: 'disable' },
      { role: 'user', action: 'reset-credentials' },
    ];

    for (const change of forged) assert.equal((await routes.handle(changePost('/members/grants', { ...validChanges.grant.fields, ...change }))).status, 403);
    const invite = await routes.handle(changePost('/invitations/send', { ...validChanges.send.fields, role: 'super-admin' }));

    assert.equal(invite.status, 403);
    assert.deepEqual(organizations.administrationCalls.map(({ request }) => (typeof request === 'string' ? request : `${'action' in request ? request.action : 'invite'} ${'role' in request ? request.role : ''}`)), [
      'grant super-admin', 'revoke admin', 'deactivate user', 'disable user', 'reset-credentials user', 'invite super-admin',
    ]);
  });

  test('Given a change that fails in the service, when it is posted, then it gets the failure page with the session cookies and no redirect, and the operator gets the path and the cause', async () => {
    const outage = new Error('directory change timed out');
    const { routes, failures } = serveAdministration({ change: outage });

    for (const [, { path, fields }] of changes) {
      await assertPage(await routes.handle(changePost(path, fields)), { status: 500, text: /The request failed\. Try again later\./, cookies: sessionCookies });
    }

    assert.deepEqual(failures, changes.map(([, { path }]) => ({ path, cause: outage })));
  });

  test('Given a signed-out session or access that the resolver denies, when a change is posted, then it gets 401 or 403 before any form check, and the service is not asked', async () => {
    const signedOut = serveAdministration();
    const denied = serveAdministration({}, { routes: { decisions: new Map([[ann.subject, { allowed: false, reason: 'permission-required' }]]) } });

    const answers = [
      await signedOut.routes.handle(postForm(validChanges.grant.path, { cookie: 'session=ended', body: new URLSearchParams(validChanges.grant.fields).toString() })),
      await denied.routes.handle(changePost(validChanges.grant.path, validChanges.grant.fields)),
    ];

    assert.deepEqual(answers.map(({ status }) => status), [401, 403]);
    assert.deepEqual([signedOut.organizations.administrationCalls, denied.organizations.administrationCalls], [[], []]);
  });
});
