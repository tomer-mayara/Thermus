import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { InvitationOverview, MemberOverview } from '../../../src/organizations/administration-overviews.ts';
import { formsIn } from '../../support/drivers/browser/hosted-browser.ts';
import { accountRequest, ann, assertPage, publicOrigin } from './fixtures/account-routes-fixtures.ts';
import { acmeInvitations, acmeMembers, annToken, formPageHeaders, serveAdministration, sessionCookies } from './fixtures/administration-routes-fixtures.ts';

function headersWithoutCookies(response: Response): Record<string, string> {
  return Object.fromEntries([...response.headers].filter(([name]) => name !== 'set-cookie'));
}

const grantForm = (membershipId: string, revision: string, change: { role: string; action: string }) => ({ csrf_token: annToken, organization_id: 'org-a', membership_id: membershipId, revision, ...change });

describe('HostedAccountRoutes member and invitation pages', () => {
  for (const method of ['GET', 'HEAD']) {
    test(`Given allowed access and a member overview, when a ${method} request opens the members page with forged organization values, then the service gets the user of the decided context with the MFA evidence of the session and the organization of the context, and the page shows the seat count and one form for each change, with the session token, the organization, the membership, and its revision`, async () => {
      const { routes, organizations, resolver } = serveAdministration({ members: acmeMembers });

      const response = await routes.handle(accountRequest('/members?organizationId=org-b', 'session=ann', { method, headers: { 'X-Organization-Id': 'org-b' } }));
      const body = await response.text();

      assert.equal(response.status, 200);
      assert.deepEqual(headersWithoutCookies(response), formPageHeaders);
      assert.deepEqual(response.headers.getSetCookie(), sessionCookies);
      assert.match(body, /<p>Active User seats: 2<\/p>/);
      assert.match(body, /<p>ann@example\.com: active\. Roles: User, Admin\.<\/p>/);
      assert.match(body, /<p>dora@example\.com: active\. Roles: none\.<\/p>/);
      assert.match(body, /<p>ivy@example\.com: inactive\. Roles: User\.<\/p>/);
      assert.match(body, /<a href="\/invitations">Invitations<\/a>/);
      assert.deepEqual(formsIn(body), [
        { action: '/members/grants', fields: grantForm('membership-ann', 'r7', { role: 'user', action: 'revoke' }), label: 'Revoke User from ann@example.com' },
        { action: '/members/grants', fields: grantForm('membership-dora', 'r2', { role: 'user', action: 'grant' }), label: 'Grant User to dora@example.com' },
      ]);
      assert.doesNotMatch(body, /<script|<link|<img|<style/i);
      assert.deepEqual(organizations.administrationCalls, [{ operation: 'memberOverview', actor: { user: ann, mfaCompleted: true }, request: 'org-a' }]);
      assert.deepEqual(resolver.calls, [ann]);
    });
  }

  for (const policy of ['invited-address', 'provider-rules'] as const) {
    test(`Given an invitation overview with the ${policy} identity policy, when the invitations page opens, then it has a send form with an email field for each role that the actor can invite, a resend and a revoke form for each pending invitation of its authority, each invitation with its role and state, and the policy text of the directory`, async () => {
      const { routes, organizations } = serveAdministration({ invitations: { ...acmeInvitations, identityPolicy: policy } });

      const response = await routes.handle(accountRequest('/invitations', 'session=ann'));
      const body = await response.text();

      assert.equal(response.status, 200);
      assert.deepEqual(headersWithoutCookies(response), formPageHeaders);
      assert.deepEqual(formsIn(body), [
        { action: '/invitations/send', fields: { csrf_token: annToken, organization_id: 'org-a', role: 'user' }, label: 'Invite as User' },
        { action: '/invitations/resend', fields: { csrf_token: annToken, organization_id: 'org-a', invitation_id: 'invitation-1' }, label: 'Resend the invitation to new@example.com' },
        { action: '/invitations/revoke', fields: { csrf_token: annToken, organization_id: 'org-a', invitation_id: 'invitation-1' }, label: 'Revoke the invitation to new@example.com' },
      ]);
      assert.match(body, /<label>Email address <input type="email" name="email" required maxlength="254"><\/label>/);
      assert.match(body, /<p>new@example\.com: User invitation, pending\.<\/p>/);
      assert.match(body, /<p>boss@example\.com: Admin invitation, pending\.<\/p>/);
      assert.match(body, /<p>old@example\.com: User invitation, expired\.<\/p>/);
      assert.match(body, /<a href="\/members">Members<\/a>/);
      assert.equal(/Only a sign-in with the invited email address can accept the invitation\./.test(body), policy === 'invited-address');
      assert.equal(/The sign-in service decides who can accept the invitation\./.test(body), policy === 'provider-rules');
      assert.deepEqual(organizations.administrationCalls.map(({ operation, request }) => [operation, request]), [['invitationOverview', 'org-a']]);
    });
  }

  test('Given an invitations page, when it opens, then it says that the acceptance of a pending invitation gives its role, and that the role of another invitation can be the current role of the member', async () => {
    const { routes } = serveAdministration({ invitations: acmeInvitations });

    const body = await (await routes.handle(accountRequest('/invitations', 'session=ann'))).text();

    assert.match(body, /The acceptance of a pending invitation gives the role that the page shows\. For an accepted, revoked, or expired invitation, the sign-in service can show the current role of the member instead\./);
  });

  test('Given an unknown identity policy from the directory, when the invitations page opens, then the page claims no strict address match', async () => {
    const { routes } = serveAdministration({ invitations: { ...acmeInvitations, identityPolicy: 'same-address-maybe' as InvitationOverview['identityPolicy'] } });

    const body = await (await routes.handle(accountRequest('/invitations', 'session=ann'))).text();

    assert.doesNotMatch(body, /Only a sign-in with the invited email address/);
    assert.match(body, /The sign-in service decides who can accept the invitation\./);
  });

  test('Given provider values with HTML characters, when the members and invitations pages open, then each shows them as text', async () => {
    const hostile = '"><script>alert(1)</script>';
    const members: MemberOverview = {
      organizationId: `org-${hostile}`,
      activeUserSeats: 1,
      members: [{ membershipId: `membership-${hostile}`, email: `<b>eve</b>${hostile}@example.com`, status: 'active', roles: [`custom-${hostile}`, 'toString'], revision: `r${hostile}`, changes: [{ role: 'user', action: 'grant' }] }],
    };
    const invitations: InvitationOverview = {
      ...acmeInvitations,
      organizationId: `org-${hostile}`,
      invitations: [{ invitationId: `invitation-${hostile}`, email: `<i>new</i>${hostile}@example.com`, role: `custom-${hostile}`, state: 'pending', changes: ['revoke'] }],
    };
    const { routes } = serveAdministration({ members, invitations });

    const bodies = [
      await (await routes.handle(accountRequest('/members', 'session=ann'))).text(),
      await (await routes.handle(accountRequest('/invitations', 'session=ann'))).text(),
    ];

    for (const body of bodies) assert.doesNotMatch(body, /<script>|<b>|<i>/);
    assert.match(bodies[0] ?? '', /Roles: custom-&quot;&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;, toString\./);
    assert.deepEqual(formsIn(bodies[0] ?? '').map(({ fields, label }) => [fields.organization_id, fields.membership_id, fields.revision, label]), [
      [`org-${hostile}`, `membership-${hostile}`, `r${hostile}`, `Grant User to <b>eve</b>${hostile}@example.com`],
    ]);
    assert.deepEqual(formsIn(bodies[1] ?? '').map(({ fields, label }) => [fields.invitation_id, label]).at(-1), [`invitation-${hostile}`, `Revoke the invitation to <i>new</i>${hostile}@example.com`]);
  });

  test('Given an organization without invitations, when the invitations page opens, then it says so and still offers the send forms', async () => {
    const { routes } = serveAdministration({ invitations: { ...acmeInvitations, invitableRoles: ['user', 'admin'], invitations: [] } });

    const body = await (await routes.handle(accountRequest('/invitations', 'session=ann'))).text();

    assert.match(body, /<p>There are no invitations\.<\/p>/);
    assert.deepEqual(formsIn(body).map(({ label }) => label), ['Invite as User', 'Invite as Admin']);
  });

  test('Given a session whose sign-in did not complete MFA, when the pages open and the service requires MFA, then the service gets that evidence and each page gets the MFA notice with the session cookies and no form', async () => {
    const { routes, organizations } = serveAdministration({ members: 'mfa-required', invitations: 'mfa-required' }, { session: { mfaCompleted: false } });

    for (const path of ['/members', '/invitations']) {
      await assertPage(await routes.handle(accountRequest(path, 'session=ann')), { status: 403, text: /Administration needs a sign-in that completed multi-factor authentication\./, cookies: sessionCookies });
    }

    assert.deepEqual(organizations.administrationCalls.map(({ actor }) => actor.mfaCompleted), [false, false]);
  });

  test('Given a service that denies the actor, when the pages open, then each gets 403 with a link to the organization page and the session cookies', async () => {
    const { routes } = serveAdministration({ members: 'denied', invitations: 'denied' });

    for (const path of ['/members', '/invitations']) {
      const response = await routes.handle(accountRequest(path, 'session=ann'));
      assert.equal(response.status, 403);
      assert.deepEqual(response.headers.getSetCookie(), sessionCookies);
      assert.match(await response.text(), /<a href="\/organizations">organization page<\/a>/);
    }
  });

  test('Given access that the resolver denies, when the pages open, then each gets 403 before the service runs', async () => {
    const { routes, organizations } = serveAdministration({ members: acmeMembers }, { routes: { decisions: new Map([[ann.subject, { allowed: false, reason: 'membership-inactive' }]]) } });

    for (const path of ['/members', '/invitations']) assert.equal((await routes.handle(accountRequest(path, 'session=ann'))).status, 403);

    assert.deepEqual(organizations.administrationCalls, []);
  });

  for (const method of ['POST', 'PUT', 'DELETE']) {
    test(`Given a ${method} request, when it reaches a page, then it gets 405 with Allow: GET, HEAD and the session cookies, and the service is not asked`, async () => {
      const { routes, organizations } = serveAdministration({ members: acmeMembers, invitations: acmeInvitations });

      for (const path of ['/members', '/invitations']) {
        const response = await routes.handle(accountRequest(path, 'session=ann', { method, headers: { Origin: publicOrigin } }));
        assert.equal(response.headers.get('Allow'), 'GET, HEAD');
        await assertPage(response, { status: 405, text: /This page does not accept this request method\./, cookies: sessionCookies });
      }

      assert.deepEqual(organizations.administrationCalls, []);
    });
  }

  test('Given an overview that fails, when the pages open, then each gets the failure page with the session cookies, and the operator gets the path and the cause', async () => {
    const outage = new Error('organization directory timed out');
    const { routes, failures } = serveAdministration({ members: outage, invitations: outage });

    for (const path of ['/members', '/invitations']) {
      await assertPage(await routes.handle(accountRequest(path, 'session=ann')), { status: 500, text: /The request failed\. Try again later\./, cookies: sessionCookies });
    }

    assert.deepEqual(failures, [{ path: '/members', cause: outage }, { path: '/invitations', cause: outage }]);
  });

  test('Given a public URL under a path, when the pages open, then each form posts under that path and each link points under it', async () => {
    const { routes } = serveAdministration({ members: acmeMembers, invitations: acmeInvitations }, { routes: { publicBaseUrl: 'https://thermus.example/team' } });

    const members = await (await routes.handle(accountRequest('/team/members', 'session=ann'))).text();
    const invitations = await (await routes.handle(accountRequest('/team/invitations', 'session=ann'))).text();

    assert.deepEqual([...new Set(formsIn(members).map(({ action }) => action))], ['/team/members/grants']);
    assert.deepEqual([...new Set(formsIn(invitations).map(({ action }) => action))], ['/team/invitations/send', '/team/invitations/resend', '/team/invitations/revoke']);
    assert.match(members, /<a href="\/team\/invitations">Invitations<\/a>/);
    assert.match(invitations, /<a href="\/team\/members">Members<\/a>/);
  });

  test('Given a decided context without an organization, when the pages open, then each gets the 403 access denial and the service is not asked', async () => {
    const { routes, organizations } = serveAdministration({ members: acmeMembers }, {
      routes: { decisions: new Map([[ann.subject, { allowed: true, context: { user: ann, tenantId: 'local:installation', grants: [], permissions: [] } }]]) },
    });

    for (const path of ['/members', '/invitations']) assert.equal((await routes.handle(accountRequest(path, 'session=ann'))).status, 403);

    assert.deepEqual(organizations.administrationCalls, []);
  });
});
