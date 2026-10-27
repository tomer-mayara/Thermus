import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, test } from 'node:test';
import { parseHTML } from 'linkedom';
import type { InvitationOverview } from '../../../src/accounts/organizations/administration-overviews.ts';
import { formsIn } from '../../support/drivers/browser/hosted-browser.ts';
import { accountRequest, ann, assertPage, publicOrigin } from './fixtures/account-routes-fixtures.ts';
import { acmeInvitations, acmeMembers, annToken, serveAdministration, sessionCookies } from './fixtures/administration-routes-fixtures.ts';

const current = { members: acmeMembers, invitations: acmeInvitations };

describe('HostedAccountRoutes combined Members page', () => {
  test('Given complete member facts with absent and unknown roles, when Members opens, then active rows have labelled facts, their own count, and only supported removal controls', async () => {
    const [member] = acmeMembers.members;
    assert.ok(member);
    const { routes, organizations } = serveAdministration({ ...current, members: { ...acmeMembers, members: [...acmeMembers.members, { ...member, membershipId: 'custom', subject: 'custom', email: 'custom@example.com', roles: ['observer'], removable: false }] } });
    const body = await (await routes.handle(accountRequest('/members', 'session=ann'))).text();
    const document = parseHTML(body).document;
    assert.equal(document.querySelector('h1')?.textContent, 'Members · 3');
    assert.match(body, /Active product members: 1/);
    const rows = [...document.querySelectorAll('.member-list > li')];
    assert.deepEqual(rows.map(row => [...row.querySelectorAll('dt')].map(label => label.textContent)), Array.from({ length: 3 }, () => ['Member', 'Role', 'Action']));
    assert.deepEqual(rows.map(row => row.querySelector('.member-role dd')?.textContent), ['User, Admin', 'none', 'observer']);
    assert.deepEqual(rows.map(row => row.querySelectorAll('form').length), [1, 0, 0]);
    assert.equal(document.querySelectorAll('.member-list select, .member-list input:not([type="hidden"])').length, 0);
    assert.deepEqual(organizations.administrationCalls.map(({ operation }) => operation), ['memberOverview', 'invitationOverview']);
  });

  test('Given an invitable role, when Members opens, then one closed native disclosure beside Members contains the protected Send invitation form before the list', async () => {
    const { routes } = serveAdministration(current);
    const document = parseHTML(await (await routes.handle(accountRequest('/members', 'session=ann'))).text()).document;
    const disclosure = document.querySelector('details.member-invitation');
    assert.ok(disclosure, 'Members has an invitation disclosure');
    assert.equal(disclosure.hasAttribute('open'), false);
    assert.equal(disclosure.querySelector('summary')?.textContent, 'Invite member');
    assert.equal(disclosure.parentElement?.querySelector('h1')?.textContent, 'Members · 2');
    assert.equal(disclosure.querySelectorAll('form').length, 1);
    assert.equal(disclosure.querySelector('button')?.textContent, 'Send invitation');
    assert.equal(document.querySelector('main form'), disclosure.querySelector('form'));
    assert.equal(disclosure.querySelector('input[type="email"]')?.getAttribute('maxlength'), '254');
    assert.ok((disclosure.textContent ?? '').indexOf('Only a sign-in') < (disclosure.textContent ?? '').indexOf('Send invitation'));
  });

  test('Given a public base path, when Members opens, then invitation Cancel is an ordinary Members GET link', async () => {
    const { routes } = serveAdministration(current, { routes: { publicBaseUrl: 'https://thermus.example/team' } });
    const document = parseHTML(await (await routes.handle(accountRequest('/team/members', 'session=ann'))).text()).document;
    const cancel = document.querySelector('details.member-invitation a');
    assert.equal(cancel?.textContent, 'Cancel');
    assert.equal(cancel?.getAttribute('href'), '/team/members');
    assert.equal(cancel?.hasAttribute('onclick'), false);
  });

  test('Given no invitable roles, when Members opens, then no invitation trigger or send form is offered', async () => {
    const { routes } = serveAdministration({ ...current, invitations: { ...acmeInvitations, invitableRoles: [] } });
    const body = await (await routes.handle(accountRequest('/members', 'session=ann'))).text();
    assert.doesNotMatch(body, /Invite member/);
    assert.equal(formsIn(body).filter(form => form.action === '/invitations/send').length, 0);
  });

  for (const role of ['user', 'admin'] as const) {
    test(`Given only ${role} is invitable, when Members opens, then the form offers only that allowed role and keeps the existing User default`, async () => {
      const { routes } = serveAdministration({ ...current, invitations: { ...acmeInvitations, invitableRoles: [role] } });
      const document = parseHTML(await (await routes.handle(accountRequest('/members', 'session=ann'))).text()).document;
      const roles = [...document.querySelectorAll('input[name="role"]')];
      assert.deepEqual(roles.map(input => input.getAttribute('value')), [role]);
      assert.equal(roles[0]?.hasAttribute('checked'), role === 'user');
    });
  }

  test('Given a trusted workspace name with markup, when Members receives a forged name, then the header shows the escaped overview name beside Switch workspace', async () => {
    const organizationName = 'Acme <script>alert("name")</script> & Labs';
    const { routes, organizations } = serveAdministration({ ...current, members: { ...acmeMembers, organizationName } });
    const response = await routes.handle(accountRequest('/members?organizationName=Forged&organizationId=org-b', 'session=ann'));
    const body = await response.text();
    const document = parseHTML(body).document;
    const switchLink = [...document.querySelectorAll('header a')].find(link => link.textContent === 'Switch workspace');
    assert.ok(switchLink);
    assert.equal(switchLink.parentElement?.textContent, `${organizationName}Switch workspace`);
    assert.equal(document.querySelectorAll('header script').length, 0);
    assert.doesNotMatch(body, /Forged|<script>/);
    assert.deepEqual(organizations.administrationCalls.map(({ operation, request }) => [operation, request]), [['memberOverview', 'org-a'], ['invitationOverview', 'org-a']]);
  });

  for (const method of ['GET', 'HEAD']) {
    test(`Given current Admin access, when a ${method} request opens Members with forged organization values, then both complete reads use the trusted actor and organization`, async () => {
      const { routes, organizations, resolver } = serveAdministration(current);
      const response = await routes.handle(accountRequest('/members?organizationId=org-b', 'session=ann', { method, headers: { 'X-Organization-Id': 'org-b' } }));
      const body = await response.text();

      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      assert.deepEqual(response.headers.getSetCookie(), sessionCookies);
      assert.match(body, /Active product members: 1/);
      const rows = [...parseHTML(body).document.querySelectorAll('.member-list > li')];
      assert.deepEqual(rows.map(row => [row.querySelector('.member-email')?.textContent, row.querySelector('.member-role dd')?.textContent]), [['ann@example.com', 'User, Admin'], ['dora@example.com', 'none']]);
      assert.doesNotMatch(body, /ivy@example\.com|old@example\.com|Change role|Security|<script/);
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
        { action: '/invitations/send', fields: { csrf_token: annToken, organization_id: 'org-a', role: 'user' }, label: 'Send invitation' },
        { action: '/members/remove', fields: { csrf_token: annToken, organization_id: 'org-a', membership_id: 'membership-ann', revision: 'r7' }, label: 'Leave Acme' },
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
    assert.deepEqual(formsIn(body).map(({ label }) => label), ['Send invitation', 'Leave Acme']);
  });

  test('Given another member with the same email, when Members opens, then only the trusted subject gets the You label', async () => {
    const [member] = acmeMembers.members;
    assert.ok(member, 'The fixture has a member to copy.');
    const { routes } = serveAdministration({ ...current, members: { ...acmeMembers, members: [
      { ...member, subject: 'another-user' },
      { ...member, email: 'different@example.com', subject: ann.subject },
    ] } });
    const body = await (await routes.handle(accountRequest('/members', 'session=ann'))).text();
    const rows = [...parseHTML(body).document.querySelectorAll('.member-list > li')];
    assert.equal(rows.length, 2);
    const [otherRow, ownRow] = rows;
    assert.ok(otherRow, 'Members shows the other member.');
    assert.ok(ownRow, 'Members shows the current member.');
    assert.equal(otherRow.querySelector('.you-label'), null);
    assert.equal(ownRow.querySelector('.you-label')?.textContent, 'You');
    assert.equal(otherRow.querySelector('summary')?.getAttribute('aria-label'), 'Remove ann@example.com from Acme');
    assert.equal(ownRow.querySelector('summary')?.getAttribute('aria-label'), 'Leave Acme as different@example.com');
    assert.equal(ownRow.querySelector('button')?.textContent, 'Leave Acme');
  });

  test('Given hostile provider text and an unsupported member, when Members opens, then values are escaped and that member has no removal form', async () => {
    const hostile = '"><script>alert(1)</script>';
    const [member] = acmeMembers.members;
    const [invitation] = acmeInvitations.invitations;
    assert.ok(member, 'The fixture has a member to copy.');
    assert.ok(invitation, 'The fixture has an invitation to copy.');
    const { routes } = serveAdministration({
      members: { ...acmeMembers, organizationName: `Acme ${hostile}`, members: [{ ...member, email: `<b>person</b>${hostile}@example.com`, roles: [`custom-${hostile}`, 'toString'], removable: false }] },
      invitations: { ...acmeInvitations, invitations: [{ ...invitation, invitationId: hostile, email: `<i>new</i>${hostile}@example.com` }] },
    });
    const body = await (await routes.handle(accountRequest('/members', 'session=ann'))).text();
    assert.doesNotMatch(body, /<script>|<b>|<i>/);
    assert.equal(parseHTML(body).document.querySelector('.member-role dd')?.textContent, `custom-${hostile}, toString`);
    assert.match(body, /Invite to Acme &quot;&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/h2>/);
    assert.equal(formsIn(body)[0]?.fields.organization_id, 'org-a');
    assert.deepEqual(formsIn(body).at(-1)?.fields.invitation_id, hostile);
    assert.equal(formsIn(body).filter(form => form.action.endsWith('/members/remove')).length, 0);
    assert.doesNotMatch(body, /Change role/);
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
    assert.deepEqual([...new Set(formsIn(body).map(({ action }) => action))], ['/team/invitations/send', '/team/members/remove', '/team/invitations/resend', '/team/invitations/revoke']);
    assert.match(body, /href="\/team\/">Connect<\/a>/);
    assert.match(body, /href="\/team\/members" aria-current="page">Members<\/a>/);
    assert.match(body, /href="\/team\/logging" >Audit logs<\/a>/);
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
