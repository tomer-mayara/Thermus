import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { HostedBrowser, formsIn, type BrowserAnswer, type PageForm } from '../../support/drivers/browser/hosted-browser.ts';
import type { FakeUser } from '../../support/doubles/workos/workos-fake.ts';
import type { WorkOSSignupFake } from '../../support/doubles/workos/workos-signup-fake.ts';
import { signInThroughServer } from '../../support/dsl/workos-sign-in.ts';
import { removalForm } from '../../support/dsl/hosted-member-removal.ts';
import { signupWrites } from '../../support/dsl/workos-signup.ts';
import { hostedRootConfig } from '../../support/fixtures/hosted-config.ts';
import { signupDocuments } from '../../support/fixtures/signup-documents.ts';
import { otherOrganization, removalAdmin, removalOrganization, removalUser, serveMemberRemovalSite } from '../../support/in-process/hosted-member-removal-site.ts';
import { serveWorkOSSite, type WorkOSSite } from '../../support/in-process/workos-site.ts';
import { workosAuthority } from '../../../src/accounts/providers/workos/workos-settings.ts';

for (const status of ['inactive', 'pending'] as const) {
  test(`Given a signed-in person whose only membership is ${status}, when the person names and accepts an organization at signup, then signup creates the person's one organization with the person as its first Admin and leaves the ${status} membership unchanged`, async (t) => {
    const site = await serveWorkOSSite(t, {
      config: hostedRootConfig, organizations: ['org_FORMER'], signupFake: true,
      signup: { enabled: true, documents: signupDocuments },
    });
    const user = { id: 'user_FORMER', email: 'former@company.example', firstName: 'Former', emailVerified: true };
    site.world.users = [user];
    site.world.memberships = [{ userId: user.id, organizationId: 'org_FORMER', roles: ['user'], status }];
    const { browser } = await signInThroughServer(site, user);
    const form = await organizationForm(browser);
    signupWrites(site);

    const created = await nameAndAccept(browser, form, 'Independent Labs');

    assertOneNewOrganization(site, user, 'Independent Labs', created);
    assert.equal(site.world.statusOf(user, 'org_FORMER'), status);
    assert.deepEqual(site.world.rolesOf(user, 'org_FORMER'), ['user']);
  });
}

test('Given a person whose only membership an Admin removed through Members, when the person names and accepts an organization at signup, then signup creates the person\'s one organization, the removed membership stays removed, and the removed-member record stays', async (t) => {
  const site = await serveMemberRemovalSite(t, { config: hostedRootConfig, setUp: (world) => {
    world.memberships = world.memberships.filter((membership) => !(membership.userId === removalUser.id && membership.organizationId === otherOrganization));
  } });
  const admin = await signInThroughServer(site, removalAdmin, removalOrganization);
  const targetId = site.world.membershipId(removalUser, removalOrganization);
  const removed = await admin.browser.submit(await removalForm(admin.browser, targetId));
  assert.ok(removed.status < 400, removed.body);
  const records = structuredClone(site.removalStore.removedMembers);
  assert.deepEqual(records.map(({ subject, organizationId, membershipId }) => [subject, organizationId, membershipId]), [[removalUser.id, removalOrganization, targetId]]);
  const { browser } = await signInThroughServer(site, removalUser);
  const form = await organizationForm(browser);
  signupWrites(site);

  const created = await nameAndAccept(browser, form, 'Independent Labs');

  const organizationId = assertOneNewOrganization(site, removalUser, 'Independent Labs', created);
  assert.deepEqual([...site.world.deletedMembershipIds], [targetId]);
  assert.equal(site.world.membershipId(removalUser, removalOrganization), targetId);
  const access = await browser.open('portal/access');
  assert.equal(access.status, 200, access.body);
  assert.equal((JSON.parse(access.body) as { organizationId: string }).organizationId, organizationId);
  assert.deepEqual(site.removalStore.removedMembers, records);
});

const formerMember = { id: 'user_FORMER', email: 'former@company.example', firstName: 'Former' };

test('Given a removed-member record of the signed-in person and a removed-member read that fails, when the person names and accepts an organization at signup, then signup creates the organization and makes no removed-member read', async (t) => {
  const site = await serveMemberRemovalSite(t, { config: hostedRootConfig, setUp: (world) => { world.users = [...world.users, formerMember]; } });
  site.removalStore.removedMembers.push({ authority: workosAuthority(site.world.settings.clientId), subject: formerMember.id, organizationId: removalOrganization,
    membershipId: 'om_FORMER', operationId: randomUUID(), recordedAt: '2026-11-02T12:00:00.000Z' });
  const records = structuredClone(site.removalStore.removedMembers);
  const reads = t.mock.method(site.removalStore, 'readRemovedMember', async () => { throw new Error('removal storage outage'); });
  const { browser } = await signInThroughServer(site, formerMember);
  const form = await organizationForm(browser);
  signupWrites(site);

  const created = await nameAndAccept(browser, form, 'Independent Labs');

  assertOneNewOrganization(site, formerMember, 'Independent Labs', created);
  assert.equal(reads.mock.callCount(), 0);
  assert.deepEqual(site.removalStore.removedMembers, records);
  assert.deepEqual(site.log.lines, []);
});

for (const status of ['active', 'inactive'] as const) {
  test(`Given a legacy personal record and ${status} User membership, when signup is retried after restart with a different name, then saved facts and User status stay unchanged without an Admin grant`, async (t) => {
    const signup = { enabled: true, documents: signupDocuments };
    const site = await serveWorkOSSite(t, { config: hostedRootConfig, organizations: [], signupFake: true, signup });
    const user = { id: 'user_LEGACY', email: 'legacy@company.example', firstName: 'Legacy', emailVerified: true };
    site.world.users = [user];
    const { browser } = await signInThroughServer(site, user);
    const form = formsIn((await browser.open('signup')).body).find(({ action }) => action === '/signup');
    assert.ok(form);
    assert.equal((await browser.post('signup', { ...form.fields, organization_name: 'Original workspace', agreement: 'accepted' })).status, 303);
    const organization = site.signupFake.organizations[0];
    const organizationId = String(organization.id);
    const { authority_accepted_at: acceptedAt, agreement_sha256: _hash, ...metadata } = organization.metadata as Record<string, string>;
    organization.metadata = { ...metadata, schema: 'thermus-signup-v1', accepted_at: acceptedAt };
    site.world.setRoles(user, organizationId, ['user']);
    site.world.setStatus(user, organizationId, status);
    const retained = structuredClone(organization);
    await site.close();
    const restarted = await serveWorkOSSite(t, { config: hostedRootConfig, organizations: [], world: site.world, signup });
    const returning = new HostedBrowser(restarted.transport, restarted.publicBaseUrl, browser.cookieHeader);
    site.world.fake.takeRequests();

    const page = await returning.open('signup');
    assert.equal(page.status, status === 'active' ? 200 : 409, page.body);
    assert.deepEqual(formsIn(page.body), []);
    if (status === 'active') assert.match(page.body, /href="\/organizations\?return_to=%2F">Continue<\/a>/);
    else assert.match(page.body, /Contact support/);
    const retry = await returning.post('signup', { ...form.fields, organization_name: 'Replacement organization', agreement: 'accepted' });

    assert.equal(retry.status, status === 'active' ? 303 : 409, retry.body);
    assert.deepEqual(site.signupFake.organizations, [retained]);
    assert.deepEqual(site.world.rolesOf(user, organizationId), ['user']);
    assert.equal(site.world.statusOf(user, organizationId), status);
    assert.deepEqual(site.world.fake.takeRequests().filter(({ method, path }) => method !== 'GET' && path !== '/user_management/authenticate'), []);
    assert.equal((await returning.open('portal/access')).status, status === 'active' ? 200 : 403);
  });
}

for (const otherAccess of [false, true]) {
  test(`Given a broken retained record and ${otherAccess ? 'another current workspace' : 'no other workspace'}, when signup is inspected after restart, then it requires support${otherAccess ? ' and permits Continue to that workspace' : ''} without repairing the record`, async (t) => {
    const signup = { enabled: true, documents: signupDocuments };
    const site = await serveWorkOSSite(t, { config: hostedRootConfig, organizations: ['org_OTHER'], signupFake: true, signup });
    const user = { id: 'user_BROKEN', email: 'broken@company.example', firstName: 'Person', emailVerified: true };
    site.world.users = [user];
    const { browser } = await signInThroughServer(site, user);
    const form = formsIn((await browser.open('signup')).body).find(({ action }) => action === '/signup');
    assert.ok(form);
    assert.equal((await browser.post('signup', { ...form.fields, organization_name: 'Saved Labs', agreement: 'accepted' })).status, 303);
    const organization = site.signupFake.organizations[0];
    organization.metadata = { ...organization.metadata as Record<string, string>, agreement_sha256: 'broken' };
    if (otherAccess) site.world.memberships = [...site.world.memberships, { userId: user.id, organizationId: 'org_OTHER', roles: ['admin'], status: 'active' }];
    const retained = structuredClone(organization);
    await site.close();
    const restarted = await serveWorkOSSite(t, { config: hostedRootConfig, organizations: [], world: site.world, signup });
    const returning = new HostedBrowser(restarted.transport, restarted.publicBaseUrl, browser.cookieHeader);
    site.world.fake.takeRequests();

    const page = await returning.open('signup');
    assert.equal(page.status, 409, page.body);
    assert.match(page.body, /Contact support/);
    assert.deepEqual(formsIn(page.body), []);
    assert.equal(page.body.includes('Continue to another workspace'), otherAccess);
    assert.equal((await returning.post('signup', { ...form.fields, organization_name: 'Replacement Labs', agreement: 'accepted' })).status, 409);
    assert.deepEqual(site.world.fake.takeRequests().filter(({ method }) => method !== 'GET'), []);
    assert.deepEqual(site.signupFake.organizations, [retained]);
    assert.equal(site.world.statusOf(user, String(organization.id)), 'active');
    assert.deepEqual(site.world.rolesOf(user, String(organization.id)), ['admin']);
    if (otherAccess) {
      const selection = formsIn((await returning.open('organizations?return_to=%2F')).body).find(({ fields }) => fields.organization_id === 'org_OTHER');
      assert.ok(selection);
      assert.equal((await returning.submit(selection)).status, 303);
      const access = await returning.open('portal/access');
      assert.equal(access.status, 200, access.body);
      assert.equal((JSON.parse(access.body) as { organizationId: string }).organizationId, 'org_OTHER');
    }
  });
}

test('Given current User and Admin memberships in invited organizations, when the person names and accepts an organization at signup, then the person\'s own organization opens at Quick start with the person as its first Admin, and both invited workspaces stay selectable', async (t) => {
  const site = await serveWorkOSSite(t, {
    config: hostedRootConfig, organizations: ['org_USER', 'org_ADMIN'], signupFake: true,
    signup: { enabled: true, documents: signupDocuments },
  });
  const user = { id: 'user_MULTIPLE', email: 'member@company.example', firstName: 'Member', emailVerified: true };
  site.world.users = [user];
  site.world.memberships = [{ userId: user.id, organizationId: 'org_USER', roles: ['user'], status: 'active' },
    { userId: user.id, organizationId: 'org_ADMIN', roles: ['admin'], status: 'active' }];
  const invited = structuredClone(site.world.memberships);
  const { browser } = await signInThroughServer(site, user);
  const form = await organizationForm(browser);
  signupWrites(site);

  const created = await nameAndAccept(browser, form, 'Member Labs');

  const ownOrganization = assertOneNewOrganization(site, user, 'Member Labs', created);
  const own = await browser.open('portal/access');
  assert.equal(own.status, 200, own.body);
  const { organizationId, organizationName, roles } = JSON.parse(own.body) as { organizationId: string; organizationName: string; roles: string[] };
  assert.deepEqual({ organizationId, organizationName, roles }, { organizationId: ownOrganization, organizationName: 'Member Labs', roles: ['admin'] });
  for (const invitedOrganization of ['org_USER', 'org_ADMIN']) {
    const choices = formsIn((await browser.open('organizations?return_to=%2F')).body);
    assert.deepEqual(choices.map(({ fields }) => fields.organization_id).filter(Boolean).sort(), ['org_ADMIN', 'org_USER', ownOrganization].sort());
    const choice = choices.find(({ fields }) => fields.organization_id === invitedOrganization);
    assert.ok(choice);
    assert.equal((await browser.submit(choice)).status, 303);
    const access = await browser.open('portal/access');
    assert.equal(access.status, 200, access.body);
    assert.equal((JSON.parse(access.body) as { organizationId: string }).organizationId, invitedOrganization);
  }
  assert.deepEqual(site.world.memberships.slice(0, invited.length), invited);
  assert.deepEqual(signupWrites(site), []);
});

test('Given an account whose organization from free access exists, when it opens signup and posts the form again with another name, then signup says each account can create one organization and that this organization exists, offers Continue, and the post opens the same organization without a second organization or grant', async (t) => {
  const site = await serveWorkOSSite(t, { config: hostedRootConfig, organizations: [], signupFake: true, signup: { enabled: true, documents: signupDocuments } });
  const user = { id: 'user_CREATOR', email: 'creator@company.example', firstName: 'Creator', emailVerified: true };
  site.world.users = [user];
  const { browser } = await signInThroughServer(site, user);
  const form = await organizationForm(browser);
  signupWrites(site);
  const organizationId = assertOneNewOrganization(site, user, 'First Labs', await nameAndAccept(browser, form, 'First Labs'));
  const saved = structuredClone(site.signupFake.organizations);
  const memberships = structuredClone(site.world.memberships);

  const page = await browser.open('signup');
  const posted = await nameAndAccept(browser, form, 'Second Labs');

  assert.equal(page.status, 200, page.body);
  const notice = parseHTML(page.body).document;
  assert.equal(notice.querySelector('h1')?.textContent, 'Your organization exists');
  assert.equal(notice.querySelector('.notice-message')?.textContent, 'Each Thermus account can create one organization through free access. This account already created its organization. Continue to open it.');
  const action = notice.querySelector('.primary-action');
  assert.equal(action?.textContent, 'Continue');
  assert.equal(action?.getAttribute('href'), '/organizations?return_to=%2F');
  assert.deepEqual(formsIn(page.body), []);
  assert.ok(!page.body.includes(signupDocuments.terms.text));
  assert.equal(posted.status, 303, posted.body);
  assert.equal(posted.location?.pathname, '/quick-start');
  const access = await browser.open('portal/access');
  assert.equal(access.status, 200, access.body);
  assert.equal((JSON.parse(access.body) as { organizationId: string }).organizationId, organizationId);
  assert.deepEqual(site.signupFake.organizations, saved);
  assert.deepEqual(site.world.memberships, memberships);
  assert.deepEqual(signupWrites(site), []);
});

// Opens signup as the signed-in person and gives the organization form, which the page must offer.
async function organizationForm(browser: HostedBrowser): Promise<PageForm> {
  const page = await browser.open('signup');
  assert.equal(page.status, 200, page.body);
  const form = formsIn(page.body).find(({ action }) => action === '/signup');
  assert.ok(form, page.body);
  return form;
}

// Posts the organization form with this name and the accepted agreement, as the person does in the browser.
function nameAndAccept(browser: HostedBrowser, form: PageForm, organizationName: string): Promise<BrowserAnswer> {
  return browser.post('signup', { ...form.fields, organization_name: organizationName, agreement: 'accepted' });
}

// Signup created one organization with this name, made the person its first Admin, and opened Quick start. The writes
// are those after the last signupWrites call: one organization and one membership. Gives the ID of the organization.
function assertOneNewOrganization(site: WorkOSSite & { readonly signupFake: WorkOSSignupFake }, user: FakeUser, organizationName: string, answer: BrowserAnswer): string {
  assert.equal(answer.status, 303, answer.body);
  assert.equal(answer.location?.pathname, '/quick-start');
  assert.equal(site.signupFake.organizations.length, 1);
  const [organization] = site.signupFake.organizations;
  assert.equal(organization?.name, organizationName);
  const organizationId = String(organization?.id);
  assert.deepEqual(site.world.rolesOf(user, organizationId), ['admin']);
  assert.equal(site.world.statusOf(user, organizationId), 'active');
  assert.deepEqual(signupWrites(site).map(({ method, path }) => `${method} ${path}`), ['POST /organizations', 'POST /user_management/organization_memberships']);
  return organizationId;
}
