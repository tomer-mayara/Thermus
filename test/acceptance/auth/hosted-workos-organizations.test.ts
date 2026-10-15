import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import { composeWorkOSApplication } from '../../../src/hosted-workos-application.ts';
import { loadDeploymentConfig } from '../../../src/config/deployment-config.ts';
import { startHttpServer } from '../../../src/http/server.ts';
import { formsIn, listenerTransport, type BrowserAnswer, type HostedBrowser } from '../../support/drivers/browser/hosted-browser.ts';
import { formFor, statusesOf } from '../../support/in-process/hosted-organization-site.ts';
import { signInThroughServer, type WorkOSServerSite } from '../../support/dsl/workos-sign-in.ts';
import { WorkOSWorld, type WorldMembership, type WorldUser } from '../../support/doubles/workos/workos-fake.ts';
import { mcpRequest } from '../../support/drivers/mcp/mcp-http-request.ts';

// The real hosted composition with the WorkOS provider and the WorkOS organization reads, behind the real HTTP server
// on a loopback port. A local fake of the WorkOS API stands in for WorkOS, so these specifications prove the
// application side only. The hosted live gate proves the same flows against WorkOS.

const config = loadDeploymentConfig({ DEPLOYMENT: 'hosted', PUBLIC_BASE_URL: 'https://thermus.example/team' }, 'http');
const sessionCookie = '__Host-thermus-session';
const acme = 'org_01ACME';
const globex = 'org_01GLOBEX';
const initech = 'org_01INITECH';
const umbrella = 'org_01UMBRELLA';
const hooli = 'org_01HOOLI';
const organizationNames = { [acme]: 'Acme', [globex]: 'Globex', [initech]: 'Initech', [umbrella]: 'Umbrella', [hooli]: 'Hooli' };

const ada: WorldUser = { id: 'user_01ADA', email: 'ada@example.com', firstName: 'Ada' };
const cid: WorldUser = { id: 'user_01CID', email: 'cid@example.com', firstName: 'Cid' };
const dee: WorldUser = { id: 'user_01DEE', email: 'dee@example.com', firstName: 'Dee' };
const ivy: WorldUser = { id: 'user_01IVY', email: 'ivy@example.com', firstName: 'Ivy' };
const otto: WorldUser = { id: 'user_01OTTO', email: 'otto@example.com', firstName: 'Otto' };
const sam: WorldUser = { id: 'user_01SAM', email: 'sam@example.com', firstName: 'Sam' };

// Ada: User and Admin in Acme, User in Globex, inactive in Initech, and only the default role in Umbrella. Cid: only
// the default role in Acme. Dee: no membership. Ivy: only an inactive membership in Acme. Otto: User in Hooli. Sam:
// only Super Admin in Acme.
const memberships: readonly WorldMembership[] = [
  { userId: ada.id, organizationId: acme, roles: ['user', 'admin'] },
  { userId: ada.id, organizationId: globex, roles: ['user'] },
  { userId: ada.id, organizationId: initech, roles: ['user', 'admin'], status: 'inactive' },
  { userId: ada.id, organizationId: umbrella, roles: [] },
  { userId: cid.id, organizationId: acme, roles: [] },
  { userId: ivy.id, organizationId: acme, roles: ['user', 'admin'], status: 'inactive' },
  { userId: otto.id, organizationId: hooli, roles: ['user'] },
  { userId: sam.id, organizationId: acme, roles: ['super-admin'] },
];

class LogLines {
  readonly lines: string[] = [];
  readonly info = (message: string): void => { this.lines.push(`INFO ${message}`); };
  readonly error = (message: string): void => { this.lines.push(`ERROR ${message}`); };
}

interface Site extends WorkOSServerSite {
  readonly log: LogLines;
}

async function openSite(t: TestContext): Promise<Site> {
  const world = await WorkOSWorld.start(t, config.publicBaseUrl, Object.keys(organizationNames));
  world.memberships = memberships;
  world.organizationNames = organizationNames;
  const log = new LogLines();
  const application = await composeWorkOSApplication(config, world.connection(), log);
  const server = await startHttpServer(application.handle, { listen: { host: '127.0.0.1', port: 0 }, publicBaseUrl: config.publicBaseUrl, logger: log });
  t.after(async () => {
    await server.close();
    await application.close();
  });
  return { world, transport: listenerTransport(server.url), publicBaseUrl: config.publicBaseUrl, log };
}

async function signIn(site: Site, user: WorldUser, organizationId?: string): Promise<HostedBrowser> {
  const { browser, callback } = await signInThroughServer(site, user, organizationId);
  assert.equal(callback.status, 303, callback.body);
  return browser;
}

async function sessionOrganization(browser: HostedBrowser): Promise<unknown> {
  const answer = await browser.open('session', { Accept: 'application/json' });
  assert.equal(answer.status, 200, answer.body);
  return (JSON.parse(answer.body) as Record<string, unknown>).organizationId;
}

async function mcpStatus(site: Site, user: WorldUser, organizationId: string): Promise<number> {
  const token = await site.world.connectToken(user, { org_id: organizationId });
  return (await site.transport(mcpRequest({ url: config.mcpResourceUrl, method: 'server/discover', token }))).status;
}

function sessionCookiesOf(answer: BrowserAnswer): string[] {
  return answer.cookies.filter((cookie) => cookie.startsWith(`${sessionCookie}=`) && !/Max-Age=0/i.test(cookie));
}

// The organizations that a refresh of a browser session asked WorkOS to switch to, from each recorded request.
function switchesIn(site: Site): unknown[] {
  return site.world.fake.takeRequests()
    .filter(({ method, path }) => method === 'POST' && path.startsWith('/user_management/authenticate'))
    .map(({ body }) => (body as Record<string, unknown> | undefined)?.organization_id)
    .filter((organizationId) => organizationId !== undefined);
}

function assertOnboarding(answer: BrowserAnswer, who: string): void {
  assert.equal(answer.status, 200, `${who}: ${answer.body}`);
  assert.match(answer.body, /Your account has no active access to an organization\./, who);
  assert.match(answer.body, /accept the invitation in the email/, who);
  assert.match(answer.body, /contact the operator of this Thermus service/, who);
  assert.doesNotMatch(answer.body, /<form/, who);
}

describe('Hosted WorkOS edition: organization onboarding and selection from WorkOS organization reads', () => {
  test('Given signed-in users without an authorized active organization in WorkOS — no membership, only an inactive membership, or only the default role —, when each opens the organization page, then each gets the invitation and operator guidance without an organization or a form, and the protected portal request, the member and invitation pages, and the MCP endpoint refuse each of them, without a default tenant or role', async (t) => {
    const site = await openSite(t);
    const visitors = [{ user: dee, organizationId: undefined }, { user: ivy, organizationId: undefined }, { user: cid, organizationId: acme }];

    for (const { user, organizationId } of visitors) {
      const browser = await signIn(site, user, organizationId);
      const onboarding = await browser.open('organizations');

      assertOnboarding(onboarding, user.firstName);
      assert.equal(await sessionOrganization(browser), organizationId, user.firstName);
      assert.deepEqual(await statusesOf(browser, ['portal/access', 'members', 'invitations']), { 'portal/access': 403, members: 403, invitations: 403 }, user.firstName);
      assert.equal(await mcpStatus(site, user, acme), 403, user.firstName);
    }
    assert.deepEqual(switchesIn(site), []);
    assert.ok(site.log.lines.every((line) => !line.startsWith('ERROR')), site.log.lines.join('\n'));
  });

  test('Given a member with User and Admin in Acme, User in Globex, an inactive membership in Initech, and only the default role in Umbrella, whose memberships WorkOS gives on several pages, when the member opens the organization page and selects Globex for the portal, then only Acme and Globex are offered with their WorkOS names, the browser goes to the portal with a new session cookie, and the portal and the billing page check the current grants of Globex', async (t) => {
    const site = await openSite(t);
    site.world.membershipPageSize = 1;
    const browser = await signIn(site, ada, acme);

    const list = await browser.open('organizations?return_to=/team/portal/access');
    const forms = formsIn(list.body);
    const before = browser.cookieHeader;
    const selected = await browser.submit(formFor(forms, 'Globex'));
    const portal = await browser.follow(selected);
    const relisted = formsIn((await browser.open('organizations')).body);

    assert.equal(list.status, 200, list.body);
    assert.deepEqual(forms.map(({ action, label, fields }) => ({ action, label, organization: fields.organization_id, returnTo: fields.return_to })), [
      { action: '/team/organizations/select', label: 'Acme (selected)', organization: acme, returnTo: '/team/portal/access' },
      { action: '/team/organizations/select', label: 'Globex', organization: globex, returnTo: '/team/portal/access' },
    ]);
    assert.equal(selected.status, 303, selected.body);
    assert.equal(selected.location?.href, 'https://thermus.example/team/portal/access');
    assert.equal(selected.headers.get('Cache-Control'), 'no-store');
    assert.equal(sessionCookiesOf(selected).length, 1);
    assert.notEqual(browser.cookieHeader, before);
    assert.equal(portal.status, 200, portal.body);
    assert.deepEqual(JSON.parse(portal.body), { organizationId: globex, roles: ['user'] });
    assert.equal((await browser.open('billing')).status, 403);
    assert.equal(await sessionOrganization(browser), globex);
    assert.deepEqual(relisted.map(({ label }) => label), ['Acme', 'Globex (selected)']);
    assert.deepEqual(switchesIn(site), [globex]);
  });

  test('Given the same member, when a selection form names the inactive Initech, the default-role Umbrella, the Hooli of another user, or an unknown organization, also with forged organization values in the query and the headers, then each selection is refused with 403, WorkOS gets no switch, and the session keeps Acme', async (t) => {
    const site = await openSite(t);
    const browser = await signIn(site, ada, acme);
    const acmeForm = formFor(formsIn((await browser.open(`organizations?organizationId=${hooli}`, { 'X-Organization-Id': hooli })).body), 'Acme (selected)');

    const refusals = [];
    for (const organizationId of [initech, umbrella, hooli, 'org_01UNKNOWN']) {
      const forged = { ...acmeForm, action: `${acmeForm.action}?organizationId=${organizationId}`, fields: { ...acmeForm.fields, organization_id: organizationId } };
      refusals.push(await browser.submit(forged, { headers: { 'X-Organization-Id': organizationId } }));
    }
    const portal = await browser.open(`portal/access?organizationId=${hooli}`, { 'X-Organization-Id': hooli });

    for (const refusal of refusals) {
      assert.equal(refusal.status, 403, refusal.body);
      assert.match(refusal.body, /Your account has no access to this organization\./);
      assert.equal(refusal.location, undefined);
      assert.deepEqual(sessionCookiesOf(refusal), []);
    }
    assert.deepEqual(JSON.parse(portal.body), { organizationId: acme, roles: ['user', 'admin'] });
    assert.equal(await sessionOrganization(browser), acme);
    assert.deepEqual(switchesIn(site), []);
  });

  test('Given memberships that change in WorkOS after the organization page was shown — Globex deactivated and a new User membership in Hooli —, when the member selects each, then the current WorkOS read decides: Globex is refused without a switch, and Hooli is selected', async (t) => {
    const site = await openSite(t);
    const browser = await signIn(site, ada, acme);
    const shown = formsIn((await browser.open('organizations')).body);

    site.world.memberships = [
      ...memberships.map((membership) => (membership.userId === ada.id && membership.organizationId === globex ? { ...membership, status: 'inactive' as const } : membership)),
      { userId: ada.id, organizationId: hooli, roles: ['user'] },
    ];
    const refused = await browser.submit(formFor(shown, 'Globex'));
    const offered = formsIn((await browser.open('organizations')).body);
    const selected = await browser.submit(formFor(offered, 'Hooli'));

    assert.deepEqual(shown.map(({ label }) => label), ['Acme (selected)', 'Globex']);
    assert.equal(refused.status, 403, refused.body);
    assert.deepEqual(offered.map(({ label }) => label), ['Acme (selected)', 'Hooli']);
    assert.equal(selected.status, 303, selected.body);
    assert.equal(await sessionOrganization(browser), hooli);
    assert.deepEqual(switchesIn(site), [hooli]);
  });

  test('Given a member with only Super Admin in Acme, when it opens the organization page and selects Acme for the billing page, then Acme is offered and selected, and its billing page, an administration page of Super Admin, opens; but the protected portal request and the MCP endpoint refuse it, because no User grant is inferred', async (t) => {
    const site = await openSite(t);
    const browser = await signIn(site, sam);

    const forms = formsIn((await browser.open('organizations?return_to=/team/billing')).body);
    const selected = await browser.submit(formFor(forms, 'Acme'));
    const billing = await browser.follow(selected);
    const portal = await browser.open('portal/access');

    assert.deepEqual(forms.map(({ label }) => label), ['Acme']);
    assert.equal(selected.status, 303, selected.body);
    assert.equal(await sessionOrganization(browser), acme);
    assert.equal(billing.status, 200, billing.body);
    assert.match(billing.body, /Plan: Free/);
    assert.equal(portal.status, 403);
    assert.deepEqual(JSON.parse(portal.body), { access: 'denied' });
    assert.equal(await mcpStatus(site, sam, acme), 403);
  });

  test('Given a signed-in member, when a selection comes from another origin or with another form token, then each is refused with 403 before any organization read, and WorkOS gets no switch', async (t) => {
    const site = await openSite(t);
    const browser = await signIn(site, ada, acme);
    const globexForm = formFor(formsIn((await browser.open('organizations')).body), 'Globex');
    site.world.fake.takeRequests();

    const foreign = await browser.submit(globexForm, { origin: 'https://evil.example' });
    const missingOrigin = await browser.submit(globexForm, { origin: null });
    const forged = await browser.submit({ ...globexForm, fields: { ...globexForm.fields, csrf_token: 'forged-token' } });
    const reads = site.world.fake.takeRequests().filter(({ path }) => path.startsWith('/user_management/organization_memberships'));

    for (const refusal of [foreign, missingOrigin, forged]) assert.equal(refusal.status, 403, refusal.body);
    assert.deepEqual(reads, []);
    assert.equal(await sessionOrganization(browser), acme);
    assert.deepEqual(switchesIn(site), []);
  });

  test('Given a session whose access token expired, when the member selects Globex, selects Initech, and meets a WorkOS membership outage, then each answer carries the refreshed session cookie: the 303 before the cookie of the switch, the 403 refusal, and the 500 failure page with an operator report; an outage never shows the onboarding guidance', async (t) => {
    const site = await openSite(t);
    site.world.expireAccessTokens();
    const browser = await signIn(site, ada, acme);
    const forms = formsIn((await browser.open('organizations')).body);
    const initechForm = { ...formFor(forms, 'Globex'), fields: { ...formFor(forms, 'Globex').fields, organization_id: initech } };

    const selected = await browser.submit(formFor(forms, 'Globex'));
    const refused = await browser.submit(initechForm);
    site.world.membershipOutage = { status: 500, body: { message: 'Internal error' } };
    const failedPage = await browser.open('organizations');
    const failedSelection = await browser.submit(formFor(forms, 'Acme (selected)'));

    assert.equal(selected.status, 303, selected.body);
    assert.equal(sessionCookiesOf(selected).length, 2, 'The 303 lacks the refreshed cookie or the cookie of the switch.');
    assert.equal(refused.status, 403, refused.body);
    assert.equal(sessionCookiesOf(refused).length, 1, 'The refusal lacks the refreshed session cookie.');
    for (const failure of [failedPage, failedSelection]) {
      assert.equal(failure.status, 500, failure.body);
      assert.match(failure.body, /The request failed\. Try again later\./);
      assert.doesNotMatch(failure.body, /no active access to an organization/);
      assert.equal(sessionCookiesOf(failure).length, 1, 'The failure page lacks the refreshed session cookie.');
    }
    assert.ok(site.log.lines.some((line) => line.startsWith('ERROR An account request failed unexpectedly for /team/organizations:')), site.log.lines.join('\n'));
    assert.ok(site.log.lines.some((line) => line.startsWith('ERROR An account request failed unexpectedly for /team/organizations/select:')), site.log.lines.join('\n'));
    assert.deepEqual(switchesIn(site).filter((organizationId) => organizationId !== acme && organizationId !== globex), []);
    site.world.membershipOutage = undefined;
    assert.equal(await sessionOrganization(browser), globex);
  });
});
