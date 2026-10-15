import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import { composeWorkOSApplication } from '../../../src/hosted-workos-application.ts';
import { loadDeploymentConfig } from '../../../src/config/deployment-config.ts';
import { startHttpServer } from '../../../src/http/server.ts';
import { formsIn, listenerTransport, type BrowserAnswer, type HostedBrowser, type PageForm } from '../../support/drivers/browser/hosted-browser.ts';
import { signInThroughServer, type WorkOSServerSite } from '../../support/dsl/workos-sign-in.ts';
import { WorkOSFake, type FakeMembership, type FakeUser } from '../../support/doubles/workos/workos-fake.ts';
import { mcpRequest } from '../../support/drivers/mcp/mcp-http-request.ts';

// The real hosted composition with the WorkOS provider and the WorkOS organization administration, behind the real HTTP
// server on a loopback port. A local fake of the WorkOS API stands in for WorkOS: it keeps the roles of each membership
// as single-role assignments, the invitations, and the users, as the probes of WorkOS staging showed. These
// specifications prove the application side only. The hosted live gate proves the same flows against WorkOS.

const config = loadDeploymentConfig({ DEPLOYMENT: 'hosted', PUBLIC_BASE_URL: 'https://thermus.example/team' }, 'http');
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

// Acme: Sam has only Super Admin, Dan Super Admin and Admin, Cal only Admin, Ada and Hal User and Admin, Bea only
// User, Gus only the default role, and Eve an inactive membership that had User and Admin. Globex: Bea and Pia have
// User. Thus Acme has three active User seats: Ada, Bea, and Hal.
const memberships: readonly FakeMembership[] = [
  { userId: sam.id, organizationId: acme, roles: ['super-admin'] },
  { userId: dan.id, organizationId: acme, roles: ['super-admin', 'admin'] },
  { userId: cal.id, organizationId: acme, roles: ['admin'] },
  { userId: ada.id, organizationId: acme, roles: ['user', 'admin'] },
  { userId: bea.id, organizationId: acme, roles: ['user'] },
  { userId: hal.id, organizationId: acme, roles: ['user', 'admin'] },
  { userId: eve.id, organizationId: acme, roles: ['user', 'admin'], status: 'inactive' },
  { userId: gus.id, organizationId: acme, roles: [] },
  { userId: bea.id, organizationId: globex, roles: ['user'] },
  { userId: pia.id, organizationId: globex, roles: ['user'] },
];

class LogLines {
  readonly lines: string[] = [];
  readonly info = (message: string): void => { this.lines.push(`INFO ${message}`); };
  readonly error = (message: string): void => { this.lines.push(`ERROR ${message}`); };
}

interface Site extends WorkOSServerSite {
  readonly log: LogLines;
}

interface WorkOSChange {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
}

async function openSite(t: TestContext): Promise<Site> {
  const world = await WorkOSFake.start(t, config.publicBaseUrl, Object.keys(organizationNames));
  world.memberships = memberships;
  world.organizationNames = organizationNames;
  world.organizationExternalIds = { [acme]: acmeExternalId };
  world.users = [sam, dan, cal, ada, bea, hal, eve, gus, pia];
  const log = new LogLines();
  const application = await composeWorkOSApplication(config, world.connection('required'), { logger: log });
  const server = await startHttpServer(application.handle, { listen: { host: '127.0.0.1', port: 0 }, publicBaseUrl: config.publicBaseUrl, logger: log });
  t.after(async () => {
    await server.close();
    await application.close();
  });
  return { world, transport: listenerTransport(server.url), publicBaseUrl: config.publicBaseUrl, log };
}

async function signIn(site: Site, user: FakeUser, organizationId = acme): Promise<HostedBrowser> {
  const { browser, callback } = await signInThroughServer(site, user, organizationId);
  assert.equal(callback.status, 303, callback.body);
  return browser;
}

async function pageOf(browser: HostedBrowser, path: string): Promise<{ readonly body: string; readonly forms: PageForm[] }> {
  const answer = await browser.open(path);
  assert.equal(answer.status, 200, `${path}: ${answer.body}`);
  return { body: answer.body, forms: formsIn(answer.body) };
}

function formNamed(forms: readonly PageForm[], label: string): PageForm {
  const form = forms.find((candidate) => candidate.label === label);
  assert.ok(form, `The page offers no form "${label}": ${JSON.stringify(forms.map((candidate) => candidate.label))}`);
  return form;
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
  const seats = /Active User seats: (\d+)/.exec(body)?.[1];
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
function changesIn(site: Site): WorkOSChange[] {
  return site.world.fake.takeRequests()
    .filter(({ method, path }) => method !== 'GET' && !path.startsWith('/user_management/authenticate'))
    .map(({ method, path, body }) => ({ method, path: path.split('?')[0] ?? path, body }));
}

// A single-role write on the authorization resource of Acme. WorkOS names that resource by the external ID of Acme,
// not by its organization ID.
function roleWrite(method: 'POST' | 'DELETE', membershipId: string, role: string): WorkOSChange {
  return {
    method,
    path: `/authorization/organization_memberships/${membershipId}/role_assignments`,
    body: { role_slug: role, resource_type_slug: 'organization', resource_external_id: acmeExternalId },
  };
}

function changeRecords(site: Site): Readonly<Record<string, unknown>>[] {
  const prefix = 'INFO Account change record: ';
  return site.log.lines.filter((line) => line.startsWith(prefix)).map((line) => JSON.parse(line.slice(prefix.length)) as Readonly<Record<string, unknown>>);
}

function recordSummaries(site: Site): string[] {
  return changeRecords(site).map((record) => {
    const actor = record.actor as { subject: string };
    return `${actor.subject} ${String(record.action)} ${String(record.role)} in ${String(record.organizationId)}: ${String(record.outcome)}`;
  });
}

async function mcpStatusWith(site: Site, token: string): Promise<number> {
  return (await site.transport(mcpRequest({ url: config.mcpResourceUrl, method: 'server/discover', token }))).status;
}

async function mcpStatus(site: Site, user: FakeUser, organizationId: string): Promise<number> {
  return mcpStatusWith(site, await site.world.connectToken(user, { org_id: organizationId }));
}

// The reads of the members of an organization. Access resolution reads the memberships of the session user, with its
// user ID, so those reads are not member reads.
function memberReadsIn(site: Site): string[] {
  return site.world.fake.takeRequests()
    .map(({ path }) => decodeURIComponent(path))
    .filter((path) => path.startsWith('/user_management/organization_memberships?') && !path.includes('user_id='));
}

describe('Hosted WorkOS edition: grant changes through single-role WorkOS writes', () => {
  test('Given Sam with only Super Admin in Acme and a sign-in with MFA, when Sam grants Admin to itself and then uses Admin to grant User to itself, then each succeeds without another person, each is one single-role WorkOS assignment on Acme, the User seats go from 3 to 4, and each change has one record without a credential', async (t) => {
    const site = await openSite(t);
    const browser = await signIn(site, sam);
    const first = await pageOf(browser, 'members');
    changesIn(site);

    const adminGrant = await browser.submit(formNamed(first.forms, 'Grant Admin to sam@example.com'));
    const second = await pageOf(browser, 'members');
    const userGrant = await browser.submit(formNamed(second.forms, 'Grant User to sam@example.com'));
    const third = await pageOf(browser, 'members');
    const samMembership = site.world.membershipId(sam, acme);

    assert.ok(labelsOf(first.forms).every((label) => !/ User (to|from) /.test(label)), `Super Admin alone may not manage User: ${labelsOf(first.forms).join(', ')}`);
    assert.ok(labelsOf(first.forms).includes('Revoke Admin from ada@example.com'));
    assertRedirectTo(adminGrant, 'members');
    assertRedirectTo(userGrant, 'members');
    assert.deepEqual(changesIn(site), [roleWrite('POST', samMembership, 'admin'), roleWrite('POST', samMembership, 'user')]);
    assert.deepEqual([...site.world.rolesOf(sam, acme)].toSorted(), ['admin', 'super-admin', 'user']);
    assert.deepEqual([seatsIn(first.body), seatsIn(third.body)], [3, 4]);
    assert.match(third.body, /sam@example\.com: active\. Roles: Super Admin, Admin, User\./);
    assert.deepEqual(recordSummaries(site), [`${sam.id} grant admin in ${acme}: applied`, `${sam.id} grant user in ${acme}: applied`]);
    for (const record of changeRecords(site)) {
      assert.deepEqual(Object.keys(record).toSorted(), ['action', 'actor', 'organizationId', 'outcome', 'role', 'target', 'time']);
      assert.deepEqual(record.target, { membershipId: samMembership });
    }
    assert.ok(site.log.lines.every((line) => !/token|csrf|refresh_|sk_test|Bearer|__Host-/i.test(line)), site.log.lines.join('\n'));
  });

  test('Given Cal with only Admin, Sam with only Super Admin, and Dan with Admin and Super Admin, when Cal posts a grant of Admin, Sam posts a grant of User, and Dan grants Admin to Bea, then Cal and Sam are refused with 403 and WorkOS gets no write for them, and the grant of Dan is applied with its Super Admin authority', async (t) => {
    const site = await openSite(t);
    const calBrowser = await signIn(site, cal);
    const samBrowser = await signIn(site, sam);
    const danBrowser = await signIn(site, dan);
    const calForm = formNamed((await pageOf(calBrowser, 'members')).forms, 'Grant User to sam@example.com');
    const samForm = formNamed((await pageOf(samBrowser, 'members')).forms, 'Grant Admin to bea@example.com');
    const danForms = (await pageOf(danBrowser, 'members')).forms;
    changesIn(site);

    const calRefusal = await calBrowser.submit({ ...calForm, fields: { ...calForm.fields, role: 'admin' } });
    const samRefusal = await samBrowser.submit({ ...samForm, fields: { ...samForm.fields, role: 'user' } });
    const refusedWrites = changesIn(site);
    const danGrant = await danBrowser.submit(formNamed(danForms, 'Grant Admin to bea@example.com'));

    assert.ok(labelsOf((await pageOf(calBrowser, 'members')).forms).every((label) => !/ Admin (to|from) /.test(label)), 'Admin alone may not manage Admin.');
    assertNotice(calRefusal, 403, /Your account cannot make this change in the selected organization\. Nothing changed\./);
    assertNotice(samRefusal, 403, /Your account cannot make this change in the selected organization\. Nothing changed\./);
    assert.deepEqual(refusedWrites, []);
    assertRedirectTo(danGrant, 'members');
    assert.deepEqual(changesIn(site), [roleWrite('POST', site.world.membershipId(bea, acme), 'admin')]);
    assert.deepEqual([...site.world.rolesOf(bea, acme)].toSorted(), ['admin', 'user']);
    assert.deepEqual(recordSummaries(site), [`${cal.id} grant admin in ${acme}: denied`, `${sam.id} grant user in ${acme}: denied`, `${dan.id} grant admin in ${acme}: applied`]);
  });

  test('Given Dan with Admin and Super Admin, when Dan revokes Admin from itself and then regrants it with the Super Admin that it kept, then both succeed: the revoke removes only Admin, the User forms go away with it, and the regrant gives Admin back', async (t) => {
    const site = await openSite(t);
    const browser = await signIn(site, dan);
    const before = await pageOf(browser, 'members');
    changesIn(site);

    const revoked = await browser.submit(formNamed(before.forms, 'Revoke Admin from dan@example.com'));
    const between = await pageOf(browser, 'members');
    const regranted = await browser.submit(formNamed(between.forms, 'Grant Admin to dan@example.com'));
    const after = await pageOf(browser, 'members');
    const danMembership = site.world.membershipId(dan, acme);

    assert.ok(labelsOf(before.forms).includes('Grant User to dan@example.com'));
    assertRedirectTo(revoked, 'members');
    assert.ok(labelsOf(between.forms).every((label) => !/ User (to|from) /.test(label)), `Without Admin, Dan manages no User: ${labelsOf(between.forms).join(', ')}`);
    assertRedirectTo(regranted, 'members');
    assert.ok(labelsOf(after.forms).includes('Grant User to dan@example.com'));
    assert.deepEqual(changesIn(site), [roleWrite('DELETE', danMembership, 'admin'), roleWrite('POST', danMembership, 'admin')]);
    assert.deepEqual([...site.world.rolesOf(dan, acme)].toSorted(), ['admin', 'super-admin']);
  });
});

describe('Hosted WorkOS edition: independent grants and revocation at the next request', () => {
  test('Given Ada and Hal with User and Admin, each with a browser session and an MCP token for Acme, when Dan revokes Admin from Ada and User from Hal, then every other grant stays: the next Admin request of Ada and the next MCP request of Hal are refused, and Ada keeps MCP access and Hal its Admin pages', async (t) => {
    const site = await openSite(t);
    const adaBrowser = await signIn(site, ada);
    const halBrowser = await signIn(site, hal);
    const danBrowser = await signIn(site, dan);
    const adaToken = await site.world.connectToken(ada, { org_id: acme });
    const halToken = await site.world.connectToken(hal, { org_id: acme });
    assert.deepEqual([(await adaBrowser.open('members')).status, await mcpStatusWith(site, adaToken), (await halBrowser.open('members')).status, await mcpStatusWith(site, halToken)], [200, 200, 200, 200]);

    const forms = (await pageOf(danBrowser, 'members')).forms;
    assertRedirectTo(await danBrowser.submit(formNamed(forms, 'Revoke Admin from ada@example.com')), 'members');
    assertRedirectTo(await danBrowser.submit(formNamed(forms, 'Revoke User from hal@example.com')), 'members');

    assert.deepEqual(site.world.rolesOf(ada, acme), ['user']);
    assert.deepEqual(site.world.rolesOf(hal, acme), ['admin']);
    assert.equal((await adaBrowser.open('members')).status, 403);
    assert.equal(await mcpStatusWith(site, adaToken), 200);
    assert.equal(await mcpStatusWith(site, halToken), 403);
    assert.equal((await halBrowser.open('members')).status, 200);
  });

  test('Given Bea with only User in Acme and User in Globex, when Hal removes its last grant in Acme, then WorkOS keeps the membership with only the default role: Bea is refused in Acme at the next request and has no seat there, keeps its identity and Globex, and no default role restores access', async (t) => {
    const site = await openSite(t);
    const beaBrowser = await signIn(site, bea);
    const halBrowser = await signIn(site, hal);
    const acmeToken = await site.world.connectToken(bea, { org_id: acme });
    const globexToken = await site.world.connectToken(bea, { org_id: globex });
    assert.deepEqual([(await beaBrowser.open('portal/access')).status, await mcpStatusWith(site, acmeToken)], [200, 200]);

    const revoked = await halBrowser.submit(formNamed((await pageOf(halBrowser, 'members')).forms, 'Revoke User from bea@example.com'));
    const members = await pageOf(halBrowser, 'members');
    const organizations = await pageOf(beaBrowser, 'organizations');

    assertRedirectTo(revoked, 'members');
    assert.deepEqual(site.world.rolesOf(bea, acme), ['member']);
    assert.equal(site.world.statusOf(bea, acme), 'active');
    assert.match(members.body, /bea@example\.com: active\. Roles: none\./);
    assert.equal(seatsIn(members.body), 2);
    assert.equal((await beaBrowser.open('portal/access')).status, 403);
    assert.equal(await mcpStatusWith(site, acmeToken), 403);
    assert.equal(await mcpStatusWith(site, globexToken), 200);
    assert.deepEqual(labelsOf(organizations.forms), ['Globex']);
    assert.equal(site.world.rolesOf(bea, globex).join(), 'user');
  });
});

describe('Hosted WorkOS edition: changes on stale, inactive, foreign, and forged targets', () => {
  test('Given a members page of Dan, when WorkOS changes Bea before Dan posts, and when Dan posts an applied grant form again after a later revoke, then each post gets 409 without a WorkOS write, so that no old form restores a revoked grant', async (t) => {
    const site = await openSite(t);
    const browser = await signIn(site, dan);
    const shown = (await pageOf(browser, 'members')).forms;

    site.world.setRoles(bea, acme, ['user', 'admin']);
    changesIn(site);
    const stale = await browser.submit(formNamed(shown, 'Grant Admin to bea@example.com'));
    const staleWrites = changesIn(site);
    const grantForm = formNamed((await pageOf(browser, 'members')).forms, 'Grant Admin to gus@example.com');
    assertRedirectTo(await browser.submit(grantForm), 'members');
    assertRedirectTo(await browser.submit(formNamed((await pageOf(browser, 'members')).forms, 'Revoke Admin from gus@example.com')), 'members');
    changesIn(site);
    const repeated = await browser.submit(grantForm);

    assertNotice(stale, 409, /changed after the page was shown\. Nothing changed\./);
    assert.deepEqual(staleWrites, []);
    assertNotice(repeated, 409, /changed after the page was shown\. Nothing changed\./);
    assert.deepEqual(changesIn(site), []);
    assert.deepEqual(site.world.rolesOf(gus, acme), ['member']);
    assert.deepEqual(recordSummaries(site).filter((line) => line.endsWith('stale')), [`${dan.id} grant admin in ${acme}: stale`, `${dan.id} grant admin in ${acme}: stale`]);
  });

  test('Given Dan in Acme, when forged posts name the inactive Eve, a membership of Globex, Super Admin, or the actions disable, deactivate, and reset-password, then each is refused with 403, WorkOS gets no write, and no grant changes', async (t) => {
    const site = await openSite(t);
    const browser = await signIn(site, dan);
    const page = await pageOf(browser, 'members');
    const template = formNamed(page.forms, 'Grant Admin to bea@example.com');
    changesIn(site);

    const forged: Readonly<Record<string, string>>[] = [
      { membership_id: site.world.membershipId(eve, acme) },
      { membership_id: site.world.membershipId(pia, globex) },
      { membership_id: site.world.membershipId(bea, globex) },
      { role: 'super-admin' },
      { action: 'disable' },
      { action: 'deactivate' },
      { action: 'reset-password' },
    ];
    const answers = [];
    for (const fields of forged) answers.push(await browser.submit({ ...template, fields: { ...template.fields, ...fields } }));

    assert.match(page.body, /eve@example\.com: inactive\. Roles: User, Admin\./);
    assert.ok(labelsOf(page.forms).every((label) => !label.endsWith('eve@example.com')), 'An inactive membership has no change form.');
    for (const answer of answers) assertNotice(answer, 403, /Your account cannot make this change in the selected organization\. Nothing changed\./);
    assert.deepEqual(changesIn(site), []);
    assert.deepEqual(site.world.rolesOf(eve, acme), ['user', 'admin']);
    assert.equal(site.world.statusOf(eve, acme), 'inactive');
    assert.deepEqual(site.world.rolesOf(pia, globex), ['user']);
    assert.deepEqual(site.world.rolesOf(bea, acme), ['user']);
  });

  test('Given a session whose sign-in gave no MFA evidence, when Dan opens the members and invitations pages and posts a grant with the form token of the session, then each gets the 403 MFA notice, and WorkOS gets no member, invitation, or role read or write', async (t) => {
    const site = await openSite(t);
    site.world.authenticationMethod = 'GoogleOAuth';
    const browser = await signIn(site, dan);
    const csrfToken = await formTokenOf(browser);
    site.world.fake.takeRequests();

    const answers = [
      await browser.open('members'),
      await browser.open('invitations'),
      await browser.post('members/grants', { organization_id: acme, membership_id: site.world.membershipId(bea, acme), revision: 'r1', role: 'admin', action: 'grant', csrf_token: csrfToken }),
    ];
    const administrationRequests = site.world.fake.takeRequests()
      .filter(({ path }) => /role_assignments|\/invitations|\/users\/|organization_memberships\/om_/.test(path) || (path.includes('organization_id=') && !path.includes('user_id=')));

    for (const answer of answers) assertNotice(answer, 403, /Administration needs a sign-in that completed multi-factor authentication\./);
    assert.deepEqual(administrationRequests, []);
  });
});

describe('Hosted WorkOS edition: organization invitations', () => {
  test('Given Dan with Admin and Super Admin, when Dan invites a new address as User, repeats the send, invites it as Admin, invites the active Ada, resends, and revokes, then WorkOS gets one send with only the User role, one resend, and one revoke; the repeat changes nothing, both other sends get 409 address-in-use, and the page shows the state that WorkOS gives without a token or link', async (t) => {
    const site = await openSite(t);
    const browser = await signIn(site, dan);
    const first = await pageOf(browser, 'invitations');
    const invite = (role: 'User' | 'Admin', email: string) => {
      const form = formNamed(first.forms, `Invite as ${role}`);
      return browser.submit({ ...form, fields: { ...form.fields, email } });
    };
    changesIn(site);

    const sent = await invite('User', 'new@example.com');
    const repeated = await invite('User', 'NEW@example.com');
    const asAdmin = await invite('Admin', 'new@example.com');
    const member = await invite('Admin', 'ada@example.com');
    const pending = await pageOf(browser, 'invitations');
    const resent = await browser.submit(formNamed(pending.forms, 'Resend the invitation to new@example.com'));
    const revoked = await browser.submit(formNamed(pending.forms, 'Revoke the invitation to new@example.com'));
    const after = await pageOf(browser, 'invitations');
    const invitation = site.world.invitations.find(({ email }) => email === 'new@example.com');
    assert.ok(invitation, 'WorkOS has no invitation for new@example.com.');
    const { token, acceptInvitationUrl } = await site.world.connection('required').workos.userManagement.getInvitation(invitation.id);

    assert.deepEqual(labelsOf(first.forms), ['Invite as User', 'Invite as Admin']);
    assert.match(first.body, /The sign-in service decides who can accept the invitation\. It can accept a sign-in with another address, for example an address of the same domain\./);
    assert.doesNotMatch(first.body, /Only a sign-in with the invited email address can accept the invitation\./);
    assertRedirectTo(sent, 'invitations');
    assertRedirectTo(repeated, 'invitations');
    assertNotice(asAdmin, 409, /This email address already belongs to a member of the organization, or it has a pending invitation\. Nothing changed\./);
    assertNotice(member, 409, /This email address already belongs to a member of the organization, or it has a pending invitation\. Nothing changed\./);
    assert.match(pending.body, /new@example\.com: User invitation, pending\./);
    assertRedirectTo(resent, 'invitations');
    assertRedirectTo(revoked, 'invitations');
    assert.match(after.body, /new@example\.com: User invitation, revoked\./);
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

  test('Given Eve with an inactive membership that had User and Admin, when Hal invites Eve as User and Eve accepts in AuthKit, then the membership becomes active with only User: no earlier Admin returns, the invitations page shows the acceptance, and the User seats count Eve', async (t) => {
    const site = await openSite(t);
    const browser = await signIn(site, hal);
    const form = formNamed((await pageOf(browser, 'invitations')).forms, 'Invite as User');

    assertRedirectTo(await browser.submit({ ...form, fields: { ...form.fields, email: 'eve@example.com' } }), 'invitations');
    const pendingMembers = await pageOf(browser, 'members');
    const invitation = site.world.invitations.find(({ email }) => email === 'eve@example.com');
    assert.ok(invitation, 'WorkOS has no invitation for Eve.');
    site.world.acceptInvitation(invitation.id);
    const members = await pageOf(browser, 'members');
    const invitations = await pageOf(browser, 'invitations');

    assert.match(pendingMembers.body, /eve@example\.com: pending\. Roles: User\./);
    assert.equal(seatsIn(pendingMembers.body), 3);
    assert.deepEqual(site.world.rolesOf(eve, acme), ['user']);
    assert.equal(site.world.statusOf(eve, acme), 'active');
    assert.match(members.body, /eve@example\.com: active\. Roles: User\./);
    assert.equal(seatsIn(members.body), 4);
    assert.match(invitations.body, /eve@example\.com: User invitation, accepted\./);
    assert.equal(await mcpStatus(site, eve, acme), 200);
  });

  test('Given Cal with only Admin, a User invitation whose expiry passed while WorkOS still says pending, and a pending Admin invitation, when Cal opens the invitations page, posts an Admin invitation, and posts a resend of the expired User invitation, then the page offers only User invitations and shows the expired User invitation and the pending Admin invitation, and both posts are refused without a WorkOS change', async (t) => {
    const site = await openSite(t);
    site.world.invitations = [
      { id: 'invitation_01OLD', email: 'old@example.com', organizationId: acme, roleSlug: 'user', state: 'pending', expiresAt: '2099-01-01T00:00:00.000Z' },
      { id: 'invitation_01ADMIN', email: 'boss@example.com', organizationId: acme, roleSlug: 'admin', state: 'pending', expiresAt: '2099-01-01T00:00:00.000Z' },
    ];
    site.world.expireInvitation('invitation_01OLD');
    const browser = await signIn(site, cal);
    const page = await pageOf(browser, 'invitations');
    changesIn(site);

    const userForm = formNamed(page.forms, 'Invite as User');
    const adminInvite = await browser.submit({ ...userForm, fields: { ...userForm.fields, role: 'admin', email: 'x@example.com' } });
    const resend = await browser.post('invitations/resend', { csrf_token: userForm.fields.csrf_token ?? '', organization_id: acme, invitation_id: 'invitation_01OLD' });

    assert.deepEqual(labelsOf(page.forms), ['Invite as User']);
    assert.match(page.body, /old@example\.com: User invitation, expired\./);
    assert.match(page.body, /boss@example\.com: Admin invitation, pending\./);
    assertNotice(adminInvite, 403, /Your account cannot make this change in the selected organization\. Nothing changed\./);
    assertNotice(resend, 409, /The invitation is no longer pending/);
    assert.deepEqual(changesIn(site), []);
  });
});

describe('Hosted WorkOS edition: the User seat summary from every WorkOS page', () => {
  test('Given WorkOS pages of two memberships that repeat one membership on the next page, when Dan opens the members page, then each active User membership counts once — Ada, Bea, and Hal —, and Admin-only, Super-Admin-only, default-role, inactive, and pending memberships count zero', async (t) => {
    const site = await openSite(t);
    site.world.membershipPageSize = 2;
    site.world.membershipPageOverlap = 1;
    site.world.invitations = [];
    const browser = await signIn(site, dan);
    const form = formNamed((await pageOf(browser, 'invitations')).forms, 'Invite as User');
    assertRedirectTo(await browser.submit({ ...form, fields: { ...form.fields, email: 'newcomer@example.com' } }), 'invitations');
    site.world.fake.takeRequests();

    const page = await pageOf(browser, 'members');
    const pageReads = memberReadsIn(site);

    assert.equal(seatsIn(page.body), 3);
    assert.ok(pageReads.length >= 5, `WorkOS gave the members on ${pageReads.length} pages.`);
    for (const path of pageReads) assert.match(path, new RegExp(`organization_id=${acme}.*statuses=active,inactive,pending|statuses=active,inactive,pending.*organization_id=${acme}`));
    assert.equal(page.body.split('ada@example.com: active').length, 2, 'A repeated membership is listed more than once.');
    assert.match(page.body, /newcomer@example\.com: pending\. Roles: User\./);
  });

  test('Given a WorkOS outage on a later page of the members, when Dan opens the members page and grants User to Gus, then the page gives the 500 failure page with an operator report and no partial count, and the applied grant keeps its record although the seat update failed', async (t) => {
    const site = await openSite(t);
    site.world.membershipPageSize = 3;
    const browser = await signIn(site, dan);
    const forms = (await pageOf(browser, 'members')).forms;
    site.world.laterMembershipPageOutage = { status: 500, body: { message: 'Internal error' } };

    const page = await browser.open('members');
    const grant = await browser.submit(formNamed(forms, 'Grant User to gus@example.com'));

    for (const answer of [page, grant]) {
      assert.equal(answer.status, 500, answer.body);
      assert.match(answer.body, /The request failed\. Try again later\./);
      assert.doesNotMatch(answer.body, /Active User seats/);
    }
    assert.ok(site.log.lines.some((line) => line.startsWith('ERROR An account request failed unexpectedly for /team/members:')), site.log.lines.join('\n'));
    assert.deepEqual(site.world.rolesOf(gus, acme), ['member', 'user']);
    assert.deepEqual(recordSummaries(site), [`${dan.id} grant user in ${acme}: applied`]);
  });
});
