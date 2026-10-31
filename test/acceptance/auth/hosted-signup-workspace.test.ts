import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { FakeUser, WorkOSFake } from '../../support/doubles/workos/workos-fake.ts';
import { HostedBrowser, formsIn } from '../../support/drivers/browser/hosted-browser.ts';
import { signupDocuments } from '../../support/fixtures/signup-documents.ts';
import { openSignupWorkspaceSite } from '../../support/in-process/signup-workspace-site.ts';

// SO-07 of the self on-boarding plan: free signup requests the tenant of the new organization after its confirmed
// first Admin membership, and GET /workspace/status gives the portal the state of the tenant of the organization of the
// request. The control plane is the real hosted composition against the WorkOS fake, with the registry rules of the
// tenants owner over an in-memory registry. The portal specifications show how the portal shows each answer.

const settingUp = 'Setting up your workspace. This takes about two minutes.';
const fullCap = 'All free workspaces are in use. Try again later.';
const setupFailed = 'Workspace setup failed. We have been notified and will fix it.';

const creator: FakeUser = { id: 'user_FREE_CREATOR', email: 'creator@example.com', firstName: 'Creator', emailVerified: true };
const existingOrganization = 'org_01EXISTING';
const member: FakeUser = { id: 'user_EXISTING_MEMBER', email: 'member@example.com', firstName: 'Member', emailVerified: true };

function withMember(roles: readonly string[], organizations: readonly string[] = [existingOrganization]) {
  return (world: WorkOSFake): void => {
    world.users = [member];
    world.memberships = organizations.map((organizationId) => ({ userId: member.id, organizationId, roles }));
    world.organizationNames = Object.fromEntries(organizations.map((organizationId) => [organizationId, `Name of ${organizationId}`]));
  };
}

describe('Free signup requests the tenant of the new organization (SO-07)', () => {
  test('Given an eligible visitor at /signup?tier=free, when the agreement is accepted, then the organization exists, its row is requested, and the workspace status gives the setup state until the row is live', async (t) => {
    const site = await openSignupWorkspaceSite(t);

    const { browser, answer, organizationId } = await site.signUp(creator, 'Acme Labs');

    assert.equal(answer.status, 303, answer.body);
    assert.equal(answer.location?.pathname, '/quick-start');
    assert.ok(organizationId, 'The organization exists.');
    assert.deepEqual(site.world.rolesOf(creator, organizationId), ['admin']);
    assert.equal(site.registry.stateOf(organizationId), 'requested');
    assert.deepEqual(await site.status(browser), { status: 200, body: { state: 'requested', ready: false, message: settingUp } });
    for (const state of ['creating', 'deploying'] as const) {
      site.provision(organizationId, state);
      assert.deepEqual(await site.status(browser), { status: 200, body: { state, ready: false, message: settingUp } });
    }
    site.provision(organizationId, 'live', 'http://thermus-tenant-org-personal1:8080');
    assert.deepEqual(await site.status(browser), { status: 200, body: { state: 'live', ready: true } });
    assert.deepEqual(site.registry.inserts, [organizationId]);
  });

  test('Given /signup with another tier value or with no tier, when a visitor opens it, then the route treats it as ?tier=free', async (t) => {
    const site = await openSignupWorkspaceSite(t);
    site.world.users = [creator];
    const { browser: visitor } = await site.signIn(creator);
    const free = await visitor.open('signup?tier=free');

    for (const path of ['signup?tier=team', 'signup?tier=', 'signup?tier=free&tier=team', 'signup']) {
      const answer = await visitor.open(path);
      assert.equal(answer.status, free.status, path);
      assert.equal(answer.body, free.body, path);
    }
    const form = formsIn(free.body).find(({ action }) => action === '/signup');
    assert.ok(form, 'The free signup page offers the organization form.');
    const created = await visitor.post('signup', { ...form.fields, organization_name: 'Tier Labs', agreement: 'accepted' });
    assert.equal(created.status, 303, created.body);
    assert.equal(site.registry.inserts.length, 1);
  });

  test('Given the signup switch off, when a visitor opens /signup?tier=free, then the closed notice shows as today, and no registry read or tenant request happens', async (t) => {
    const site = await openSignupWorkspaceSite(t, { signupEnabled: false });
    site.world.users = [creator];
    const { browser } = await site.signIn(creator);

    const answer = await browser.open('signup?tier=free');

    assert.equal(answer.status, 200);
    assert.match(answer.body, /Activation is closed/);
    assert.doesNotMatch(answer.body, new RegExp(signupDocuments.notice.text));
    assert.equal(site.registry.reads, 0);
    assert.deepEqual(site.registry.requests, []);
  });

  test('Given a full free-tenant cap, when a visitor opens /signup?tier=free, then the closed notice shows before the notice of the documents, and an old form creates no organization', async (t) => {
    const site = await openSignupWorkspaceSite(t, { freeTenantLimit: 1 });
    site.world.users = [creator];
    const { browser } = await site.signIn(creator);
    const form = formsIn((await browser.open('signup?tier=free')).body).find(({ action }) => action === '/signup');
    assert.ok(form, 'Before the cap is full, the form shows.');
    site.provision('org_01OTHERTENANT', 'live', 'http://thermus-tenant-org-01othertenant:8080');

    const signedIn = await browser.open('signup?tier=free');
    const signedOut = await new HostedBrowser(site.transport, site.publicBaseUrl).open('signup?tier=free');
    const posted = await browser.post('signup', { ...form.fields, organization_name: 'Late Labs', agreement: 'accepted' });

    for (const answer of [signedIn, signedOut]) {
      assert.equal(answer.status, 200);
      assert.match(answer.body, /Activation is closed/);
      assert.doesNotMatch(answer.body, new RegExp(signupDocuments.notice.text));
      assert.equal(formsIn(answer.body).some(({ action }) => action === '/signup'), false);
    }
    assert.equal(posted.status, 403);
    assert.match(posted.body, /Activation is closed/);
    assert.deepEqual(site.signupFake.organizations, []);
    assert.deepEqual(site.registry.requests, []);
  });

  test('Given a failed tenant request after the confirmed first Admin membership, when the portal reads GET /workspace/status, then the control plane requests the tenant again', async (t) => {
    const site = await openSignupWorkspaceSite(t);
    site.registry.insertFailure = 'unavailable';

    const { browser, answer, organizationId } = await site.signUp(creator, 'Acme Labs');

    assert.equal(answer.status, 303, answer.body);
    assert.ok(organizationId);
    assert.equal(site.registry.stateOf(organizationId), undefined);
    assert.ok(site.log.lines.some((line) => line.startsWith('ERROR ') && line.includes('Hosted signup could not request the tenant')), site.log.lines.join('\n'));
    site.registry.insertFailure = undefined;
    assert.deepEqual(await site.status(browser), { status: 200, body: { state: 'requested', ready: false, message: settingUp } });
    assert.equal(site.registry.stateOf(organizationId), 'requested');
    assert.deepEqual(site.registry.requests, [organizationId, organizationId]);
  });
});

describe('The workspace status of an organization with product access (SO-07)', () => {
  test('Given an existing organization without a row and a member with product access, when the portal reads GET /workspace/status, then a row in state requested exists and the answer is the setup state', async (t) => {
    const site = await openSignupWorkspaceSite(t, { organizations: [existingOrganization], setUp: withMember(['user']) });
    const { browser } = await site.signIn(member, existingOrganization);

    assert.deepEqual(await site.status(browser), { status: 200, body: { state: 'requested', ready: false, message: settingUp } });
    assert.equal(site.registry.stateOf(existingOrganization), 'requested');
    assert.deepEqual(site.registry.inserts, [existingOrganization]);
  });

  test('Given a member without product access, when it reads GET /workspace/status, then it gets the access denial of the portal and no tenant is requested', async (t) => {
    const site = await openSignupWorkspaceSite(t, { organizations: [existingOrganization], setUp: withMember(['member']) });
    const { browser } = await site.signIn(member, existingOrganization);

    assert.deepEqual(await site.status(browser), { status: 403, body: { access: 'denied' } });
    assert.deepEqual(site.registry.requests, []);
  });

  test('Given a request for another organization than a current membership allows, when it reads GET /workspace/status, then it gets the access denial of the portal and no tenant is requested', async (t) => {
    const other = 'org_01OTHERWORKSPACE';
    const site = await openSignupWorkspaceSite(t, { organizations: [existingOrganization, other], setUp: withMember(['user'], [existingOrganization, other]) });
    const { browser } = await site.signIn(member, existingOrganization);
    site.world.setStatus(member, existingOrganization, 'inactive');

    const answer = await browser.open(`workspace/status?organization_id=${other}`, { Accept: 'application/json' });

    assert.equal(answer.status, 403);
    assert.match(answer.body, /Access denied/);
    assert.deepEqual(site.registry.requests, []);
  });

  test('Given a full free-tenant cap and an organization without a row, when the portal reads the status again and again, then each read requests the tenant until a place frees', async (t) => {
    const site = await openSignupWorkspaceSite(t, { freeTenantLimit: 1, organizations: [existingOrganization], setUp: withMember(['user']) });
    site.provision('org_01OTHERTENANT', 'live', 'http://thermus-tenant-org-01othertenant:8080');
    const { browser } = await site.signIn(member, existingOrganization);

    assert.deepEqual(await site.status(browser), { status: 200, body: { state: 'full', ready: false, message: fullCap } });
    assert.deepEqual(await site.status(browser), { status: 200, body: { state: 'full', ready: false, message: fullCap } });
    site.provision('org_01OTHERTENANT', 'deleted');
    assert.deepEqual(await site.status(browser), { status: 200, body: { state: 'requested', ready: false, message: settingUp } });
    assert.deepEqual(site.registry.requests, [existingOrganization, existingOrganization, existingOrganization]);
  });

  test('Given a failed tenant, when the portal reads the status, then it gets the words of a failed setup, and the first read reports to the operator once', async (t) => {
    const site = await openSignupWorkspaceSite(t, { organizations: [existingOrganization], setUp: withMember(['user']) });
    site.provision(existingOrganization, 'failed');
    const { browser } = await site.signIn(member, existingOrganization);

    assert.deepEqual(await site.status(browser), { status: 200, body: { state: 'failed', ready: false, message: setupFailed } });
    assert.deepEqual(await site.status(browser), { status: 200, body: { state: 'failed', ready: false, message: setupFailed } });
    const reports = site.log.lines.filter((line) => line.startsWith('ERROR ') && line.includes('Workspace setup failed:'));
    assert.deepEqual(reports, [`ERROR Workspace setup failed: {"organizationId":"${existingOrganization}"}`]);
  });

  test('Given MCP_TENANTS_ENABLED off, when a visitor signs up and the portal reads the status, then signup inserts the requested row and the status is live, because the control plane serves the tools itself', async (t) => {
    const site = await openSignupWorkspaceSite(t, { tenantsEnabled: false });

    const { browser, answer, organizationId } = await site.signUp(creator, 'Acme Labs');

    assert.equal(answer.status, 303, answer.body);
    assert.ok(organizationId);
    assert.equal(site.registry.stateOf(organizationId), 'requested');
    const reads = site.registry.reads;
    assert.deepEqual(await site.status(browser), { status: 200, body: { state: 'live', ready: true } });
    assert.equal(site.registry.reads, reads);
    assert.deepEqual(site.registry.requests, [organizationId]);
  });
});
