import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, test } from 'node:test';
import type { InvitationOverview } from '../../../src/accounts/organizations/administration-overviews.ts';
import { formsIn } from '../../support/drivers/browser/hosted-browser.ts';
import { accountRequest, ann, assertPage, publicOrigin } from './fixtures/account-routes-fixtures.ts';
import { acmeInvitations, acmeMembers, annToken, serveAdministration, sessionCookies } from './fixtures/administration-routes-fixtures.ts';

const current = { members: acmeMembers, invitations: acmeInvitations };

describe('HostedAccountRoutes combined Members page', () => {
  for (const method of ['GET', 'HEAD']) {
    test(`Given current Admin access, when a ${method} request opens Members with forged organization values, then both complete reads use the trusted actor and organization`, async () => {
      const { routes, organizations, resolver } = serveAdministration(current);
      const response = await routes.handle(accountRequest('/members?organizationId=org-b', 'session=ann', { method, headers: { 'X-Organization-Id': 'org-b' } }));
      const body = await response.text();

      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      assert.deepEqual(response.headers.getSetCookie(), sessionCookies);
      assert.match(body, /Active product members: 1/);
      assert.match(body, /ann@example\.com: active\. Roles: User, Admin\./);
      assert.match(body, /dora@example\.com: active\. Roles: none\./);
      assert.doesNotMatch(body, /ivy@example\.com|old@example\.com|Change role|Remove member|Security|<script/);
      assert.deepEqual(organizations.administrationCalls.map(({ operation, actor, request }) => [operation, actor, request]), [
        ['memberOverview', { user: ann }, 'org-a'], ['invitationOverview', { user: ann }, 'org-a'],
      ]);
      assert.deepEqual(resolver.calls, [ann]);
      const style = /<style>([\s\S]*?)<\/style>/.exec(body)?.[1] ?? '';
      assert.notEqual(style, '');
      assert.equal(response.headers.get('Content-Security-Policy'), `default-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; style-src 'sha256-${createHash('sha256').update(style).digest('base64')}'; img-src 'self'; font-src 'self'`);
    });
  }

  for (const policy of ['invited-address', 'provider-rules'] as const) {
    test(`Given ${policy} invitations, when Members opens, then one email form defaults to User and only pending invitations have expiry and current actions`, async () => {
      const { routes } = serveAdministration({ ...current, invitations: { ...acmeInvitations, identityPolicy: policy } });
      const body = await (await routes.handle(accountRequest('/members', 'session=ann'))).text();

      assert.deepEqual(formsIn(body), [
        { action: '/invitations/send', fields: { csrf_token: annToken, organization_id: 'org-a', role: 'user' }, label: 'Invite' },
        { action: '/invitations/resend', fields: { csrf_token: annToken, organization_id: 'org-a', invitation_id: 'invitation-1' }, label: 'Resend the invitation to new@example.com' },
        { action: '/invitations/revoke', fields: { csrf_token: annToken, organization_id: 'org-a', invitation_id: 'invitation-1' }, label: 'Revoke the invitation to new@example.com' },
        { action: '/invitations/resend', fields: { csrf_token: annToken, organization_id: 'org-a', invitation_id: 'invitation-2' }, label: 'Resend the invitation to boss@example.com' },
        { action: '/invitations/revoke', fields: { csrf_token: annToken, organization_id: 'org-a', invitation_id: 'invitation-2' }, label: 'Revoke the invitation to boss@example.com' },
      ]);
      assert.equal((body.match(/type="email"/g) ?? []).length, 1);
      assert.match(body, /<label for="invite-email">Email address<\/label>/);
      assert.match(body, /<fieldset>[\s\S]*<legend>Role<\/legend>/);
      assert.match(body, /type="radio" name="role" value="user" checked/);
      assert.match(body, /type="radio" name="role" value="admin"/);
      assert.match(body, /Expires <time datetime="/);
      assert.match(body, /Admin includes product and MCP access/);
      assert.doesNotMatch(body, /Admin invitation gives no User access|old@example\.com/);
      assert.equal(/Only a sign-in with the invited email address/.test(body), policy === 'invited-address');
      assert.equal(/The sign-in service decides who can accept/.test(body), policy === 'provider-rules');
    });
  }

  test('Given an unknown identity policy, when Members opens, then it makes no strict address promise', async () => {
    const { routes } = serveAdministration({ ...current, invitations: { ...acmeInvitations, identityPolicy: 'unknown' as InvitationOverview['identityPolicy'] } });
    const body = await (await routes.handle(accountRequest('/members', 'session=ann'))).text();
    assert.doesNotMatch(body, /Only a sign-in with the invited email address/);
    assert.match(body, /The sign-in service decides who can accept/);
  });

  test('Given no pending invitations, when Members opens, then the empty state keeps the single invitation form', async () => {
    const { routes } = serveAdministration({ ...current, invitations: { ...acmeInvitations, invitations: [] } });
    const body = await (await routes.handle(accountRequest('/members', 'session=ann'))).text();
    assert.match(body, /No pending invitations/);
    assert.deepEqual(formsIn(body).map(({ label }) => label), ['Invite']);
  });

  test('Given another member with the same email, when Members opens, then only the trusted subject gets the You label', async () => {
    const [member] = acmeMembers.members;
    assert.ok(member, 'The fixture has a member to copy.');
    const { routes } = serveAdministration({ ...current, members: { ...acmeMembers, members: [
      { ...member, subject: 'another-user' },
      { ...member, email: 'different@example.com', subject: ann.subject },
    ] } });
    const body = await (await routes.handle(accountRequest('/members', 'session=ann'))).text();
    const rows = [...body.matchAll(/<li class="member-row">([\s\S]*?)<\/li>/g)].map(([, row]) => row ?? '');
    assert.equal(rows.length, 2);
    const [otherRow, ownRow] = rows;
    assert.ok(otherRow, 'Members shows the other member.');
    assert.ok(ownRow, 'Members shows the current member.');
    assert.doesNotMatch(otherRow, /You/);
    assert.match(ownRow, /You/);
  });

  test('Given hostile provider text and long values, when Members opens, then values are escaped and no member write control is added', async () => {
    const hostile = '"><script>alert(1)</script>';
    const [member] = acmeMembers.members;
    const [invitation] = acmeInvitations.invitations;
    assert.ok(member, 'The fixture has a member to copy.');
    assert.ok(invitation, 'The fixture has an invitation to copy.');
    const { routes } = serveAdministration({
      members: { ...acmeMembers, organizationName: `Acme ${hostile}`, members: [{ ...member, email: `<b>person</b>${hostile}@example.com`, roles: [`custom-${hostile}`, 'toString'] }] },
      invitations: { ...acmeInvitations, invitations: [{ ...invitation, invitationId: hostile, email: `<i>new</i>${hostile}@example.com` }] },
    });
    const body = await (await routes.handle(accountRequest('/members', 'session=ann'))).text();
    assert.doesNotMatch(body, /<script>|<b>|<i>/);
    assert.match(body, /Roles: custom-&quot;&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;, toString\./);
    assert.match(body, /Invite to Acme &quot;&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/h2>/);
    assert.equal(formsIn(body)[0]?.fields.organization_id, 'org-a');
    assert.deepEqual(formsIn(body).at(-1)?.fields.invitation_id, hostile);
    assert.doesNotMatch(body, /Remove member|Change role/);
  });

  test('Given a session without MFA, when Members opens, then current Admin access is sufficient', async () => {
    const { routes } = serveAdministration(current, { session: { mfaCompleted: false } });
    assert.equal((await routes.handle(accountRequest('/members', 'session=ann'))).status, 200);
  });

  for (const method of ['GET', 'HEAD']) {
    test(`Given current Admin access, when ${method} opens the old Invitations URL, then it redirects to Members with no history page`, async () => {
      const { routes } = serveAdministration(current);
      const response = await routes.handle(accountRequest('/invitations', 'session=ann', { method }));
      assert.equal(response.status, 303);
      assert.equal(response.headers.get('Location'), 'https://thermus.example/members');
      assert.deepEqual(response.headers.getSetCookie(), sessionCookies);
      assert.equal(await response.text(), '');
    });
  }

  test('Given a service that denies the actor, when either page opens, then current service authorization refuses it', async () => {
    const { routes } = serveAdministration({ members: 'denied', invitations: 'denied' });
    for (const path of ['/members', '/invitations']) {
      const response = await routes.handle(accountRequest(path, 'session=ann'));
      await assertPage(response, { status: 403, text: /organization page/, cookies: sessionCookies });
    }
  });

  for (const failure of ['members', 'invitations'] as const) {
    test(`Given a failed ${failure} read, when Members opens, then no partial page or invitation form is returned`, async () => {
      const outage = new Error('private provider cause');
      const { routes, failures } = serveAdministration({ ...current, [failure]: outage });
      const response = await routes.handle(accountRequest('/members', 'session=ann'));
      const body = await response.text();
      assert.equal(response.status, 500);
      assert.doesNotMatch(body, /Active product members|No pending|<form|private provider cause/);
      assert.deepEqual(response.headers.getSetCookie(), sessionCookies);
      assert.deepEqual(failures, [{ path: '/members', cause: outage }]);
    });
  }

  for (const method of ['POST', 'PUT', 'DELETE']) {
    test(`Given a ${method} request to a page, when it arrives, then no read or write runs`, async () => {
      const { routes, organizations } = serveAdministration(current);
      for (const path of ['/members', '/invitations']) {
        const response = await routes.handle(accountRequest(path, 'session=ann', { method, headers: { Origin: publicOrigin } }));
        assert.equal(response.headers.get('Allow'), 'GET, HEAD');
        await assertPage(response, { status: 405, text: /This page does not accept this request method\./, cookies: sessionCookies });
      }
      assert.deepEqual(organizations.administrationCalls, []);
    });
  }

  test('Given a base path, when Members opens, then navigation, forms, and the old page redirect remain under that path', async () => {
    const { routes } = serveAdministration(current, { routes: { publicBaseUrl: 'https://thermus.example/team' } });
    const body = await (await routes.handle(accountRequest('/team/members', 'session=ann'))).text();
    assert.deepEqual([...new Set(formsIn(body).map(({ action }) => action))], ['/team/invitations/send', '/team/invitations/resend', '/team/invitations/revoke']);
    assert.match(body, /href="\/team\/">Product \/ Connect<\/a>/);
    assert.match(body, /href="\/team\/members" aria-current="page">Members<\/a>/);
    assert.match(body, /href="\/team\/logging" >Logging<\/a>/);
    assert.match(body, /href="\/team\/organizations">Switch workspace<\/a>/);
    assert.equal((await routes.handle(accountRequest('/team/invitations', 'session=ann'))).headers.get('Location'), 'https://thermus.example/team/members');
  });

  test('Given a denied resolver or no selected organization, when either page opens, then the service is not asked', async () => {
    for (const decision of [{ allowed: false as const, reason: 'membership-inactive' as const }, { allowed: true as const, context: { user: ann, tenantId: 'local:installation', grants: [], permissions: [] } }]) {
      const { routes, organizations } = serveAdministration(current, { routes: { decisions: new Map([[ann.subject, decision]]) } });
      for (const path of ['/members', '/invitations']) assert.equal((await routes.handle(accountRequest(path, 'session=ann'))).status, 403);
      assert.deepEqual(organizations.administrationCalls, []);
    }
  });
});
