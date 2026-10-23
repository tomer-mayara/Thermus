import assert from 'node:assert/strict';
import { test } from 'node:test';
import { signInThroughServer } from '../../support/dsl/workos-sign-in.ts';
import { formLabelled, formsIn, HostedBrowser } from '../../support/drivers/browser/hosted-browser.ts';
import { mcpRequest, rpcResult } from '../../support/drivers/mcp/mcp-http-request.ts';
import { ContextReportToolSpy } from '../../support/doubles/mcp/context-report-tool-spy.ts';
import type { WorkOSFake } from '../../support/doubles/workos/workos-fake.ts';
import { serveWorkOSSite } from '../../support/in-process/workos-site.ts';

const acme = 'org_ACME';
const globex = 'org_GLOBEX';
const member = { id: 'user_INVITED', email: 'member@example.com', firstName: 'Member' };
const memberships = [
  { userId: member.id, organizationId: acme, roles: ['user'] },
  { userId: member.id, organizationId: globex, roles: ['admin'] },
];
const siteOptions = {
  organizations: [acme, globex],
  setUp: (world: WorkOSFake) => { world.memberships = memberships; world.organizationNames = { [acme]: 'Acme', [globex]: 'Globex' }; },
};

test('Given an AuthKit return with two current memberships and no selected organization or explicit return path, when the callback completes, then the existing selector opens without choosing a workspace', async (t) => {
  const site = await serveWorkOSSite(t, siteOptions);

  const { browser, callback } = await signInThroughServer(site, member);

  assert.equal(callback.status, 303, callback.body);
  assert.equal(callback.location?.pathname, '/team/organizations');
  assert.equal(callback.location.searchParams.get('return_to'), '/team/');
  const selector = await browser.follow(callback);
  assert.equal(selector.status, 200, selector.body);
  assert.deepEqual(formsIn(selector.body).map(({ label, fields }) => [label, fields.organization_id, fields.return_to]), [
    ['Acme', acme, '/team/'], ['Globex', globex, '/team/'],
  ]);
  assert.equal(JSON.parse((await browser.open('session')).body).organizationId, undefined);
});

test('Given AuthKit selected an organization with current product access, when its callback completes, then the browser opens the portal for that organization without a creator agreement or activation write', async (t) => {
  const site = await serveWorkOSSite(t, { ...siteOptions, signupFake: true });

  const { browser, callback } = await signInThroughServer(site, member, globex);
  const access = await browser.open('portal/access');

  assert.equal(callback.status, 303, callback.body);
  assert.equal(callback.location?.href, site.publicBaseUrl);
  assert.equal(access.status, 200, access.body);
  assert.equal(JSON.parse(access.body).organizationId, globex);
  assert.deepEqual(site.signupFake.organizations, []);
  assert.deepEqual(site.world.memberships, memberships);
  assert.deepEqual(site.world.fake.takeRequests().filter(({ method, path }) => method !== 'GET' && path !== '/user_management/authenticate'), []);
});

test('Given a safe explicit return path, including the portal root, when an unselected member completes sign-in, then the sealed destination is retained', async (t) => {
  const site = await serveWorkOSSite(t, siteOptions);
  for (const returnTo of ['/team/', '/team/members']) {
    const browser = new HostedBrowser(site.transport, site.publicBaseUrl);
    const start = await browser.open(`login?return_to=${encodeURIComponent(returnTo)}`);
    const query = new URLSearchParams({ code: site.world.codeFor(member), state: start.location?.searchParams.get('state') ?? '' });

    const callback = await browser.open(`callback?${query}`);

    assert.equal(callback.status, 303, callback.body);
    assert.equal(callback.location?.pathname, returnTo);
  }
});

test('Given one eligible membership without a trusted selection, when a default callback completes, then the existing selector offers that workspace without selecting it', async (t) => {
  const site = await serveWorkOSSite(t, siteOptions);
  site.world.setStatus(member, globex, 'inactive');

  const { browser, callback } = await signInThroughServer(site, member);
  const selector = await browser.follow(callback);

  assert.equal(callback.location?.pathname, '/team/organizations');
  assert.deepEqual(formsIn(selector.body).map(({ label, fields }) => [label, fields.organization_id]), [['Acme', acme]]);
  assert.equal(JSON.parse((await browser.open('session')).body).organizationId, undefined);
  assert.equal((await browser.open('portal/access')).status, 403);
});

test('Given a returned identity with no eligible membership, when the selector opens, then it gives existing invitation and signup guidance without an agreement or a workspace inferred from the email domain', async (t) => {
  const site = await serveWorkOSSite(t, siteOptions);
  const outsider = { ...member, id: 'user_OTHER' };

  const { browser, callback } = await signInThroughServer(site, outsider);
  const selector = await browser.follow(callback);

  assert.equal(callback.location?.pathname, '/team/organizations');
  assert.equal(selector.status, 200, selector.body);
  assert.match(selector.body, /accept the invitation in the email/);
  assert.match(selector.body, /Check free signup availability/);
  assert.doesNotMatch(selector.body, /<form|checkbox/);
  assert.equal((await browser.open('portal/access')).status, 403);
});

test('Given a provider-selected workspace whose membership is no longer active, when its default callback completes, then the browser selects from current memberships without an automatic switch', async (t) => {
  const site = await serveWorkOSSite(t, siteOptions);
  site.world.setStatus(member, globex, 'inactive');

  const { browser, callback } = await signInThroughServer(site, member, globex);
  const selector = await browser.follow(callback);

  assert.equal(callback.location?.pathname, '/team/organizations');
  assert.deepEqual(formsIn(selector.body).map(({ label }) => label), ['Acme']);
  assert.equal(JSON.parse((await browser.open('session')).body).organizationId, globex);
  assert.equal((await browser.open('portal/access')).status, 403);
});

test('Given no selected organization from AuthKit, when login and callback queries claim an invitation or organization, then those hints cannot choose a workspace', async (t) => {
  const site = await serveWorkOSSite(t, siteOptions);
  const browser = new HostedBrowser(site.transport, site.publicBaseUrl);
  const start = await browser.open(`login?organization_id=${globex}&invitation=accepted`);
  const query = new URLSearchParams({ code: site.world.codeFor(member), state: start.location?.searchParams.get('state') ?? '', organization_id: globex, invitation: 'accepted', email: 'admin@example.com' });

  const callback = await browser.open(`callback?${query}`);

  assert.equal(callback.location?.pathname, '/team/organizations');
  assert.equal(JSON.parse((await browser.open('session')).body).organizationId, undefined);
});

test('Given a membership read outage after code exchange, when the default callback completes, then recovery keeps the signed-in cookie and opens the selector after the outage ends', async (t) => {
  const site = await serveWorkOSSite(t, siteOptions);
  site.world.membershipOutage = { status: 503, body: { message: 'directory unavailable' } };

  const { browser, callback } = await signInThroughServer(site, member, globex);

  assert.equal(callback.status, 500, callback.body);
  assert.equal(callback.cookies.filter((cookie) => cookie.startsWith('__Host-thermus-session=') && !cookie.includes('Max-Age=0')).length, 1);
  assert.match(callback.body, /Open your workspaces/);
  assert.equal((await browser.open('session')).status, 200);
  site.world.membershipOutage = undefined;
  const recovered = await browser.open('organizations?return_to=%2Fteam%2F');
  assert.equal(recovered.status, 200, recovered.body);
  assert.deepEqual(formsIn(recovered.body).map(({ label }) => label), ['Acme', 'Globex (selected)']);
  assert.equal((await browser.open('portal/access')).status, 200);
});

test('Given a browser selected in Acme and an MCP token bound to Acme, when a native unselected return is followed by choosing Globex, then the browser opens Globex and the same token still uses Acme', async (t) => {
  const tools = new ContextReportToolSpy();
  const site = await serveWorkOSSite(t, { ...siteOptions, buildServer: tools.buildServer });
  const { browser } = await signInThroughServer(site, member, acme);
  const token = await site.world.connectToken(member, { org_id: acme });
  const request = () => mcpRequest({ url: site.world.mcpResourceUrl, method: 'tools/call', token, params: { name: ContextReportToolSpy.reportTool, arguments: {} } });
  await rpcResult(await site.transport(request()));
  const start = await browser.open('login');
  const query = new URLSearchParams({ code: site.world.codeFor(member), state: start.location?.searchParams.get('state') ?? '' });
  const callback = await browser.open(`callback?${query}`);
  const selector = await browser.follow(callback);

  const selected = await browser.submit(formLabelled(formsIn(selector.body), 'Globex'));
  const access = await browser.open('portal/access');
  await rpcResult(await site.transport(request()));

  assert.equal(selected.location?.href, site.publicBaseUrl);
  assert.equal(access.status, 200, access.body);
  assert.equal(JSON.parse(access.body).organizationId, globex);
  assert.deepEqual(tools.contexts.map(({ organizationId }) => organizationId), [acme, acme]);
});

test('Given a native return followed by workspace selection, when membership is removed or the provider refuses or cannot switch, then the completed sign-in survives and no workspace is silently chosen', async (t) => {
  const site = await serveWorkOSSite(t, siteOptions);
  const { browser, callback } = await signInThroughServer(site, member);
  const form = formLabelled(formsIn((await browser.follow(callback)).body), 'Globex');
  site.world.setStatus(member, globex, 'inactive');

  const removed = await browser.submit(form);
  site.world.setStatus(member, globex, 'active');
  site.world.refreshOutage = { status: 400, body: { error: 'organization_membership_not_found', error_description: 'Membership is not active.' } };
  const refused = await browser.submit(form);
  site.world.refreshOutage = { status: 503, body: { message: 'provider unavailable' } };
  const outage = await browser.submit(form);

  assert.deepEqual([removed.status, refused.status, outage.status], [403, 403, 500]);
  const session = await browser.open('session');
  assert.equal(session.status, 200, session.body);
  assert.equal(JSON.parse(session.body).organizationId, undefined);
  site.world.refreshOutage = undefined;
  assert.equal((await browser.submit(form)).status, 303);
  assert.equal((await browser.open('portal/access')).status, 200);
});
