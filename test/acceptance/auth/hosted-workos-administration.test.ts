import { parseHTML } from 'linkedom';
import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import { formLabelled, formsIn, type BrowserAnswer, type HostedBrowser, type PageForm } from '../../support/drivers/browser/hosted-browser.ts';
import { signInThroughServer } from '../../support/dsl/workos-sign-in.ts';
import type { FakeMembership, FakeUser } from '../../support/doubles/workos/workos-fake.ts';
import { serveWorkOSSite, type WorkOSSite } from '../../support/in-process/workos-site.ts';

// The real hosted composition with the WorkOS provider and the WorkOS organization administration, behind the real HTTP
// server on a loopback port. A local fake of the WorkOS API stands in for WorkOS: it keeps the roles of each membership
// as single-role assignments, the invitations, and the users, as the probes of WorkOS staging showed. These
// specifications prove the application side only. The hosted live gate proves the same flows against WorkOS.

const acme = 'org_01ACME';
const globex = 'org_01GLOBEX';
const organizationNames = { [acme]: 'Acme', [globex]: 'Globex' };
// Acme has an external ID, as each customer organization of the operator runbook has one.
const acmeExternalId = 'customer-acme';

function person(name: string): FakeUser {
  return { id: `user_01${name.toUpperCase()}`, email: `${name}@example.com`, firstName: `${name.charAt(0).toUpperCase()}${name.slice(1)}` };
}

const sam = person('sam');
const dan = person('dan');
const cal = person('cal');
const ada = person('ada');
const bea = person('bea');
const hal = person('hal');
const eve = person('eve');
const gus = person('gus');
const pia = person('pia');
const removalLabels = (actor: FakeUser) => [sam, dan, cal, ada, bea, hal].map(person => person.id === actor.id ? 'Leave Acme' : `Remove ${person.email}`);

// Acme: Sam, Dan, and Cal have Admin; Ada and Hal have User and Admin; Bea has User. Gus has only the default role,
// and Eve is inactive. Globex: Bea and Pia have User. Acme has six active product members.
const memberships: readonly FakeMembership[] = [
  { userId: sam.id, organizationId: acme, roles: ['admin'] },
  { userId: dan.id, organizationId: acme, roles: ['admin'] },
  { userId: cal.id, organizationId: acme, roles: ['admin'] },
  { userId: ada.id, organizationId: acme, roles: ['user', 'admin'] },
  { userId: bea.id, organizationId: acme, roles: ['user'] },
  { userId: hal.id, organizationId: acme, roles: ['user', 'admin'] },
  { userId: eve.id, organizationId: acme, roles: ['user', 'admin'], status: 'inactive' },
  { userId: gus.id, organizationId: acme, roles: [] },
  { userId: bea.id, organizationId: globex, roles: ['user'] },
  { userId: pia.id, organizationId: globex, roles: ['user'] },
];

interface WorkOSChange {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
}

const openSite = (t: TestContext) => serveWorkOSSite(t, {
  organizations: Object.keys(organizationNames),
  setUp: (world) => {
    world.memberships = memberships;
    world.organizationNames = organizationNames;
    world.organizationExternalIds = { [acme]: acmeExternalId };
    world.users = [sam, dan, cal, ada, bea, hal, eve, gus, pia];
  },
});

async function signIn(site: WorkOSSite, user: FakeUser, organizationId = acme): Promise<HostedBrowser> {
  const { browser, callback } = await signInThroughServer(site, user, organizationId);
  assert.equal(callback.status, 303, callback.body);
  return browser;
}

async function pageOf(browser: HostedBrowser, path: string): Promise<{ readonly body: string; readonly forms: PageForm[] }> {
  const answer = await browser.open(path);
  assert.equal(answer.status, 200, `${path}: ${answer.body}`);
  return { body: answer.body, forms: formsIn(answer.body) };
}

function labelsOf(forms: readonly PageForm[]): string[] {
  return forms.map(({ label }) => label);
}

// The form token of the session, as the portal reads it from the session answer. A page that the server refuses has no
// form that holds it.
async function formTokenOf(browser: HostedBrowser): Promise<string> {
  const answer = await browser.open('session', { Accept: 'application/json' });
  assert.equal(answer.status, 200, answer.body);
  const { csrfToken } = JSON.parse(answer.body) as { readonly csrfToken?: unknown };
  assert.ok(typeof csrfToken === 'string' && csrfToken !== '', `The session answer has no form token: ${answer.body}`);
  return csrfToken;
}

function seatsIn(body: string): number {
  const seats = /Active product members: (\d+)/.exec(body)?.[1];
  assert.ok(seats !== undefined, `The members page shows no seat count: ${body}`);
  return Number(seats);
}

function assertRedirectTo(answer: BrowserAnswer, page: string): void {
  assert.equal(answer.status, 303, answer.body);
  assert.equal(answer.location?.href, `https://thermus.example/team/${page}`);
}

function assertNotice(answer: BrowserAnswer, status: number, text: RegExp): void {
  assert.equal(answer.status, status, answer.body);
  assert.match(answer.body, text);
  assert.equal(answer.location, undefined);
}

// The WorkOS requests that change roles, memberships, or invitations, since the last call. A sign-in or a refresh
// changes nothing.
function changesIn(site: WorkOSSite): WorkOSChange[] {
  return site.world.fake.takeRequests()
    .filter(({ method, path }) => method !== 'GET' && !path.startsWith('/user_management/authenticate'))
    .map(({ method, path, body }) => ({ method, path: path.split('?')[0] ?? path, body }));
}

function changeRecords(site: WorkOSSite): Readonly<Record<string, unknown>>[] {
  const prefix = 'INFO Account change record: ';
  return site.log.lines.filter((line) => line.startsWith(prefix)).map((line) => JSON.parse(line.slice(prefix.length)) as Readonly<Record<string, unknown>>);
}

function recordSummaries(site: WorkOSSite): string[] {
  return changeRecords(site).map((record) => {
    const actor = record.actor as { subject: string };
    return `${actor.subject} ${String(record.action)} ${String(record.role)} in ${String(record.organizationId)}: ${String(record.outcome)}`;
  });
}

async function mcpStatusWith(site: WorkOSSite, token: string): Promise<number> {
  return (await site.discover(token)).status;
}

async function mcpStatus(site: WorkOSSite, user: FakeUser, organizationId: string): Promise<number> {
  return mcpStatusWith(site, await site.world.connectToken(user, { org_id: organizationId }));
}

// The reads of the members of an organization. Access resolution reads the memberships of the session user, with its
// user ID, so those reads are not member reads.
function memberReadsIn(site: WorkOSSite): string[] {
  return site.world.fake.takeRequests()
    .map(({ path }) => decodeURIComponent(path))
    .filter((path) => path.startsWith('/user_management/organization_memberships?') && !path.includes('user_id='));
}

describe('Hosted WorkOS edition: current grants and revocation at the next request', () => {
  test('Given Ada and Hal with User and Admin, each with a browser session and an MCP token for Acme, when the provider removes Admin from Ada and User from Hal, then Ada loses administration but keeps product access, and Hal keeps product and administration access with Admin alone', async (t) => {
    const site = await openSite(t);
    const adaBrowser = await signIn(site, ada);
    const halBrowser = await signIn(site, hal);
    const adaToken = await site.world.connectToken(ada, { org_id: acme });
    const halToken = await site.world.connectToken(hal, { org_id: acme });
    assert.deepEqual([(await adaBrowser.open('members')).status, await mcpStatusWith(site, adaToken), (await halBrowser.open('members')).status, await mcpStatusWith(site, halToken)], [200, 200, 200, 200]);

    site.world.setRoles(ada, acme, ['user']);
    site.world.setRoles(hal, acme, ['admin']);

    assert.deepEqual(site.world.rolesOf(ada, acme), ['user']);
    assert.deepEqual(site.world.rolesOf(hal, acme), ['admin']);
    assert.equal((await adaBrowser.open('members')).status, 403);
    assert.equal(await mcpStatusWith(site, adaToken), 200);
    assert.equal(await mcpStatusWith(site, halToken), 200);
    assert.equal((await halBrowser.open('members')).status, 200);
  });

  test('Given Bea with only User in Acme and User in Globex, when the provider removes its last grant in Acme, then WorkOS keeps the membership with only the default role: Bea is refused in Acme at the next request and has no seat there, keeps its identity and Globex, and no default role restores access', async (t) => {
    const site = await openSite(t);
    const beaBrowser = await signIn(site, bea);
    const halBrowser = await signIn(site, hal);
    const acmeToken = await site.world.connectToken(bea, { org_id: acme });
    const globexToken = await site.world.connectToken(bea, { org_id: globex });
    assert.deepEqual([(await beaBrowser.open('portal/access')).status, await mcpStatusWith(site, acmeToken)], [200, 200]);

    site.world.setRoles(bea, acme, ['member']);
    const members = await pageOf(halBrowser, 'members');
    const organizations = await pageOf(beaBrowser, 'organizations');

    assert.deepEqual(site.world.rolesOf(bea, acme), ['member']);
    assert.equal(site.world.statusOf(bea, acme), 'active');
    const beaRow = [...parseHTML(members.body).document.querySelectorAll('.member-list > li')].find(row => row.querySelector('.member-email')?.textContent === 'bea@example.com');
    assert.equal(beaRow?.querySelector('.member-role dd')?.textContent, 'none');
    assert.equal(seatsIn(members.body), 5);
    assert.equal((await beaBrowser.open('portal/access')).status, 403);
    assert.equal(await mcpStatusWith(site, acmeToken), 403);
    assert.equal(await mcpStatusWith(site, globexToken), 200);
    assert.deepEqual(labelsOf(organizations.forms), ['Globex']);
    assert.equal(site.world.rolesOf(bea, globex).join(), 'user');
  });
});

describe('Hosted WorkOS edition: changes on stale, inactive, foreign, and forged targets', () => {
  test('Given Dan signed in as Admin and then changed to User in WorkOS, when Dan opens administration pages or sends an invitation with the existing form token, then current membership checks deny each request before reading members or invitations or making changes', async (t) => {
    const site = await openSite(t);
    const browser = await signIn(site, dan);
    const csrfToken = await formTokenOf(browser);
    site.world.setRoles(dan, acme, ['user']);
    site.world.fake.takeRequests();

    const answers = [
      await browser.open('members'),
      await browser.open('invitations'),
      await browser.post('invitations/send', { organization_id: acme, email: 'new@example.com', role: 'user', csrf_token: csrfToken }),
    ];
    const requests = site.world.fake.takeRequests();
    const ownProfilePath = `/user_management/users/${dan.id}`;
    const administrationRequests = requests
      .filter(({ method, path }) => !(method === 'GET' && path === ownProfilePath))
      .filter(({ path }) => /role_assignments|\/invitations|\/users\/|organization_memberships\/om_/.test(path) || (path.includes('organization_id=') && !path.includes('user_id=')));

    for (const answer of answers) assert.equal(answer.status, 403, answer.body);
    assert.equal(requests.filter(({ method, path }) => method === 'GET' && path === ownProfilePath).length, answers.length);
    assert.deepEqual(administrationRequests, []);
  });
});

describe('Hosted WorkOS edition: organization invitations', () => {
  test('Given Dan with Admin alone, when Dan invites a new address as User, repeats the send, invites it as Admin, invites the active Ada, resends, and revokes, then WorkOS gets one send with only the User role, one resend, and one revoke; the repeat changes nothing, both other sends get 409 address-in-use, and the page shows the state that WorkOS gives without a token or link', async (t) => {
    const site = await openSite(t);
    const browser = await signIn(site, dan);
    const first = await pageOf(browser, 'members');
    const invite = (role: 'User' | 'Admin', email: string) => {
      const form = formLabelled(first.forms, 'Invite');
      return browser.submit({ ...form, fields: { ...form.fields, email, role: role.toLowerCase() } });
    };
    changesIn(site);

    const sent = await invite('User', 'new@example.com');
    const repeated = await invite('User', 'NEW@example.com');
    const asAdmin = await invite('Admin', 'new@example.com');
    const member = await invite('Admin', 'ada@example.com');
    const pending = await pageOf(browser, 'members');
    const resent = await browser.submit(formLabelled(pending.forms, 'Resend the invitation to new@example.com'));
    const revoked = await browser.submit(formLabelled(pending.forms, 'Revoke the invitation to new@example.com'));
    const after = await pageOf(browser, 'members');
    const invitation = site.world.invitations.find(({ email }) => email === 'new@example.com');
    assert.ok(invitation, 'WorkOS has no invitation for new@example.com.');
    const { token, acceptInvitationUrl } = await site.world.connection().workos.userManagement.getInvitation(invitation.id);

    assert.deepEqual(labelsOf(first.forms), ['Invite', ...removalLabels(dan)]);
    assert.deepEqual(first.forms.filter(form => form.action === '/team/members/remove').map(form => form.label), removalLabels(dan));
    assert.match(first.body, /The sign-in service decides who can accept the invitation\. It can accept a sign-in with another address, for example an address of the same domain\./);
    assert.doesNotMatch(first.body, /Only a sign-in with the invited email address can accept the invitation\./);
    assertRedirectTo(sent, 'members');
    assertRedirectTo(repeated, 'members');
    assertNotice(asAdmin, 409, /This email address already belongs to a member of the organization, or it has a pending invitation\. Nothing changed\./);
    assertNotice(member, 409, /This email address already belongs to a member of the organization, or it has a pending invitation\. Nothing changed\./);
    assert.match(pending.body, /new@example\.com: User invitation, pending\./);
    assertRedirectTo(resent, 'members');
    assertRedirectTo(revoked, 'members');
    assert.doesNotMatch(after.body, /new@example\.com/);
    assert.ok(labelsOf(after.forms).every((label) => !label.endsWith('new@example.com')), 'A revoked invitation has no change form.');
    assert.deepEqual(changesIn(site).map(({ method, path, body }) => `${method} ${path}${body === undefined ? '' : ` ${JSON.stringify(body)}`}`), [
      `POST /user_management/invitations ${JSON.stringify({ email: 'new@example.com', organization_id: acme, role_slug: 'user' })}`,
      `POST /user_management/invitations ${JSON.stringify({ email: 'new@example.com', organization_id: acme, role_slug: 'admin' })}`,
      `POST /user_management/invitations ${JSON.stringify({ email: 'ada@example.com', organization_id: acme, role_slug: 'admin' })}`,
      `POST /user_management/invitations/${invitation.id}/resend {}`,
      `POST /user_management/invitations/${invitation.id}/revoke`,
    ]);
    assert.deepEqual(recordSummaries(site), [
      `${dan.id} invite user in ${acme}: applied`,
      `${dan.id} invite user in ${acme}: unchanged`,
      `${dan.id} invite admin in ${acme}: address-in-use`,
      `${dan.id} invite admin in ${acme}: address-in-use`,
      `${dan.id} resend-invitation user in ${acme}: applied`,
      `${dan.id} revoke-invitation user in ${acme}: applied`,
    ]);
    for (const text of [pending.body, after.body, ...site.log.lines]) {
      assert.ok(!text.includes(token) && !text.includes(acceptInvitationUrl), 'An invitation credential reached a page or the log.');
    }
  });

  test('Given Eve with an inactive membership that had User and Admin, when Hal invites Eve as User and Eve accepts in AuthKit, then the membership becomes active with only User: no earlier Admin returns, Members no longer shows the accepted invitation, and the active product members count Eve', async (t) => {
    const site = await openSite(t);
    const browser = await signIn(site, hal);
    const form = formLabelled((await pageOf(browser, 'members')).forms, 'Invite');

    assertRedirectTo(await browser.submit({ ...form, fields: { ...form.fields, email: 'eve@example.com' } }), 'members');
    const pendingMembers = await pageOf(browser, 'members');
    const invitation = site.world.invitations.find(({ email }) => email === 'eve@example.com');
    assert.ok(invitation, 'WorkOS has no invitation for Eve.');
    site.world.acceptInvitation(invitation.id);
    const members = await pageOf(browser, 'members');

    assert.match(pendingMembers.body, /eve@example\.com: User invitation, pending\./);
    assert.equal(seatsIn(pendingMembers.body), 6);
    assert.deepEqual(site.world.rolesOf(eve, acme), ['user']);
    assert.equal(site.world.statusOf(eve, acme), 'active');
    const eveRow = [...parseHTML(members.body).document.querySelectorAll('.member-list > li')].find(row => row.querySelector('.member-email')?.textContent === 'eve@example.com');
    assert.equal(eveRow?.querySelector('.member-role dd')?.textContent, 'User');
    assert.equal(seatsIn(members.body), 7);
    assert.doesNotMatch(members.body, /eve@example\.com: User invitation/);
    assert.equal(await mcpStatus(site, eve, acme), 200);
  });

  test('Given Cal with only Admin, a User invitation whose expiry passed while WorkOS still says pending, and a pending Admin invitation, when Cal opens the invitations page, posts an Admin invitation, and posts a resend of the expired User invitation, then the page offers both roles and changes for the pending Admin invitation, the new Admin invitation succeeds, and the expired resend is refused', async (t) => {
    const site = await openSite(t);
    site.world.invitations = [
      { id: 'invitation_01OLD', email: 'old@example.com', organizationId: acme, roleSlug: 'user', state: 'pending', expiresAt: '2099-01-01T00:00:00.000Z' },
      { id: 'invitation_01ADMIN', email: 'boss@example.com', organizationId: acme, roleSlug: 'admin', state: 'pending', expiresAt: '2099-01-01T00:00:00.000Z' },
    ];
    site.world.expireInvitation('invitation_01OLD');
    const browser = await signIn(site, cal);
    const page = await pageOf(browser, 'members');
    changesIn(site);

    const userForm = formLabelled(page.forms, 'Invite');
    const adminInvite = await browser.submit({ ...userForm, fields: { ...userForm.fields, role: 'admin', email: 'x@example.com' } });
    const resend = await browser.post('invitations/resend', { csrf_token: userForm.fields.csrf_token ?? '', organization_id: acme, invitation_id: 'invitation_01OLD' });

    assert.deepEqual(labelsOf(page.forms), ['Invite', ...removalLabels(cal), 'Resend the invitation to boss@example.com', 'Revoke the invitation to boss@example.com']);
    assert.deepEqual(page.forms.filter(form => form.action === '/team/members/remove').map(form => form.label), removalLabels(cal));
    assert.doesNotMatch(page.body, /old@example\.com/);
    assert.match(page.body, /boss@example\.com: Admin invitation, pending\./);
    assertRedirectTo(adminInvite, 'members');
    assertNotice(resend, 409, /The invitation is no longer pending/);
    assert.deepEqual(changesIn(site), [{ method: 'POST', path: '/user_management/invitations', body: { email: 'x@example.com', organization_id: acme, role_slug: 'admin' } }]);
  });
});

describe('Hosted WorkOS edition: the active product member count from every WorkOS page', () => {
  test('Given WorkOS pages of two memberships that repeat one membership on the next page, when Dan opens the members page, then each active product membership counts once, including Admin-only and combined User/Admin memberships, and default-role, inactive, and pending memberships count zero', async (t) => {
    const site = await openSite(t);
    site.world.membershipPageSize = 2;
    site.world.membershipPageOverlap = 1;
    site.world.invitations = [];
    const browser = await signIn(site, dan);
    const form = formLabelled((await pageOf(browser, 'members')).forms, 'Invite');
    assertRedirectTo(await browser.submit({ ...form, fields: { ...form.fields, email: 'newcomer@example.com' } }), 'members');
    site.world.fake.takeRequests();

    const page = await pageOf(browser, 'members');
    const pageReads = memberReadsIn(site);

    assert.equal(seatsIn(page.body), 6);
    assert.ok(pageReads.length >= 5, `WorkOS gave the members on ${pageReads.length} pages.`);
    for (const path of pageReads) assert.match(path, new RegExp(`organization_id=${acme}.*statuses=active,inactive,pending|statuses=active,inactive,pending.*organization_id=${acme}`));
    assert.equal([...parseHTML(page.body).document.querySelectorAll('.member-email')].filter(email => email.textContent === 'ada@example.com').length, 1, 'A repeated membership must be listed once.');
    assert.match(page.body, /newcomer@example\.com: User invitation, pending\./);
  });

  test('Given a WorkOS outage on a later page of the members, when Dan opens the members page, then it gives the 500 failure page with an operator report and no partial count', async (t) => {
    const site = await openSite(t);
    site.world.membershipPageSize = 3;
    const browser = await signIn(site, dan);
    site.world.laterMembershipPageOutage = { status: 500, body: { message: 'Internal error' } };

    const page = await browser.open('members');

    for (const answer of [page]) {
      assert.equal(answer.status, 500, answer.body);
      assert.match(answer.body, /The request failed\. Try again later\./);
      assert.doesNotMatch(answer.body, /Active product members/);
    }
    assert.ok(site.log.lines.some((line) => line.startsWith('ERROR An account request failed unexpectedly for /team/members:')), site.log.lines.join('\n'));
    assert.deepEqual(site.world.rolesOf(gus, acme), ['member']);
    assert.deepEqual(recordSummaries(site), []);
  });
});
