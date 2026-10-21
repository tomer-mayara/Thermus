import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { AccessDenialReason } from '../../../src/accounts/identity/access-context.ts';
import type { ConfiguredAccess } from '../../support/doubles/auth/access-resolver-spy.ts';
import {
  accountRequest,
  adminGrant,
  allowedFor,
  ann,
  assertPage,
  ben,
  contextOf,
  formPost,
  serve,
  signedIn,
  userGrant,
} from './fixtures/account-routes-fixtures.ts';

describe('HostedAccountRoutes', () => {
  test('Given a signed-in browser session with allowed access, when an account request arrives, then the operation gets that request and the decided context, and the client gets the operation answer', async () => {
    const annContext = contextOf(ann, [userGrant, adminGrant], ['product:access', 'user-grants:manage']);
    const { routes, session, resolver, operations } = serve({
      sessions: new Map([['session=ann', signedIn(ann)]]),
      decisions: new Map([[ann.subject, allowedFor(annContext)]]),
    });
    const request = formPost('/organizations/grants', 'session=ann', 'role=user');

    const response = await routes.handle(request);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('X-Operation'), 'account-operation-double');
    assert.equal(operations.calls.length, 1);
    assert.equal(operations.calls[0]?.request, request);
    assert.deepEqual(operations.calls[0]?.context, annContext);
    assert.deepEqual([session.calls, resolver.calls], [['session=ann'], [ann]]);
    assert.equal(await request.text(), 'role=user', 'the routes leave the form body to the operation');
  });

  test('Given two signed-in users of different organizations whose access resolutions finish in reverse order, when their requests overlap, then each operation gets only the context of its own request', async () => {
    const annContext = contextOf(ann, [userGrant], ['product:access']);
    const benContext = contextOf(ben, [adminGrant], ['user-grants:manage']);
    const annDecided = Promise.withResolvers<void>();
    const { routes, operations } = serve({
      sessions: new Map([['session=ann', signedIn(ann)], ['session=ben', signedIn(ben)]]),
      decisions: new Map<string, ConfiguredAccess>([
        [ann.subject, async () => {
          await annDecided.promise;
          return allowedFor(annContext);
        }],
        [ben.subject, allowedFor(benContext)],
      ]),
    });

    const annAnswer = routes.handle(accountRequest('/account', 'session=ann'));
    const benAnswer = await routes.handle(accountRequest('/account', 'session=ben'));
    annDecided.resolve();
    const answers = await Promise.all([annAnswer, benAnswer].map(async (answer) => (await answer).json()));

    assert.deepEqual(answers, [{ path: '/account', context: annContext }, { path: '/account', context: benContext }]);
    assert.deepEqual(operations.calls.map(({ context }) => context.organizationId), ['org-b', 'org-a']);
  });

  test('Given a resolver that changes its records after its decision, when the operation runs, then it gets a frozen copy of the decided context that later changes cannot reach', async () => {
    const decided = contextOf(ann, [userGrant], ['product:access']);
    const records = { ...decided, user: { ...ann }, grants: [{ ...userGrant, permissions: [...userGrant.permissions] }], permissions: [...decided.permissions] };
    const { routes, operations } = serve({
      sessions: new Map([['session=ann', signedIn(ann)]]),
      decisions: new Map([[ann.subject, allowedFor(records)]]),
    });

    await routes.handle(accountRequest('/account', 'session=ann'));
    records.grants.push({ ...adminGrant, permissions: [...adminGrant.permissions] });
    records.grants[0]?.permissions.push('billing:manage');
    records.permissions.push('user-grants:manage', 'billing:manage');
    Object.assign(records, { tenantId: 'tenant-org-b', organizationId: 'org-b' });
    Object.assign(records.user, { subject: 'user-ben', selectedOrganizationId: 'org-b' });

    const context = operations.calls[0]?.context;
    assert.deepEqual(context, decided);
    assert.deepEqual([context, context?.user, context?.grants, context?.grants[0], context?.grants[0]?.permissions, context?.permissions].map(Object.isFrozen), [true, true, true, true, true, true]);
  });

  test('Given a signed-out session with cookie effects, when account, organization, and billing requests arrive, also with forged cookies, bearer tokens, organization IDs, and form input, then each gets 401 with the cookie effects of the session, and no body read, access resolution, organization read, switch, or operation runs', async () => {
    const clearedSession = ['session=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax'];
    const annSession = signedIn(ann);
    const { routes, session, resolver, organizations, operations } = serve({
      sessions: new Map([['session=ann', annSession]]),
      otherSession: { status: 'signed-out', cookies: clearedSession },
      decisions: new Map([[ann.subject, allowedFor(contextOf(ann, [userGrant], ['product:access']))]]),
    });
    const requests = [
      accountRequest('/account', 'session=ended'),
      accountRequest('/', 'wos-session=forged-session'),
      accountRequest('/account', undefined, { headers: { Authorization: 'Bearer forged-token' } }),
      accountRequest('/organizations?organizationId=org-a', 'wos-session=forged-session', { headers: { 'X-Organization-Id': 'org-a' } }),
      formPost('/organizations/select', 'wos-session=forged-session', 'organizationId=org-b'),
      formPost('/organizations/grants', 'wos-session=forged-session', 'organizationId=org-a&userId=user-ann&role=admin'),
      formPost('/billing/seats', 'wos-session=forged-session', 'organizationId=org-a&seatCount=5'),
    ];

    for (const request of requests) {
      await assertPage(await routes.handle(request), { status: 401, text: /Sign in to use this page\./, cookies: clearedSession });
      assert.equal(request.bodyUsed, false);
    }

    assert.deepEqual(session.calls, ['session=ended', 'wos-session=forged-session', null, ...Array(4).fill('wos-session=forged-session')]);
    assert.deepEqual([resolver.calls, organizations.lists, organizations.selections, organizations.administrationCalls, annSession.switches, operations.calls], [[], [], [], [], [], []]);
  });

  for (const reason of ['account-inactive', 'organization-required', 'membership-inactive', 'permission-required'] satisfies AccessDenialReason[]) {
    test(`Given the ${reason} denial, when a signed-in user requests an account operation, then it gets 403 without the reason, and no operation runs`, async () => {
      const { routes, resolver, operations } = serve({
        sessions: new Map([['session=ann', signedIn(ann)]]),
        decisions: new Map([[ann.subject, { allowed: false, reason }]]),
      });

      const response = await routes.handle(formPost('/billing/seats', 'session=ann', 'seatCount=5'));

      assert.equal(response.status, 403);
      assert.doesNotMatch(await response.clone().text(), new RegExp(reason));
      await assertPage(response, { status: 403, text: /Your account has no access to this page in the selected organization\./ });
      assert.deepEqual([resolver.calls, operations.calls], [[ann], []]);
    });
  }

  test('Given allowed access and no account operation, when a signed-in user requests a page, then it gets 404', async () => {
    const { routes, resolver } = serve({
      sessions: new Map([['session=ann', signedIn(ann)]]),
      decisions: new Map([[ann.subject, allowedFor(contextOf(ann, [userGrant], ['product:access']))]]),
      withOperation: false,
    });

    await assertPage(await routes.handle(accountRequest('/account', 'session=ann')), { status: 404, text: /This page does not exist\./ });

    assert.deepEqual(resolver.calls, [ann]);
  });

  test('Given a failed session lookup, when an account request arrives, then the failure reaches the caller, and no access resolution, operation, or report follows', async () => {
    const outage = new Error('session lookup timed out');
    const { routes, resolver, operations, failures } = serve({
      sessions: new Map([['session=ann', outage]]),
      decisions: new Map([[ann.subject, allowedFor(contextOf(ann, [userGrant], ['product:access']))]]),
    });

    await assert.rejects(routes.handle(accountRequest('/account', 'session=ann')), outage);

    assert.deepEqual([resolver.calls, operations.calls, failures], [[], [], []]);
  });
});
