import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { HostedBrowser, formsIn } from '../../support/drivers/browser/hosted-browser.ts';
import { signInThroughServer } from '../../support/dsl/workos-sign-in.ts';
import { removalForm } from '../../support/dsl/hosted-member-removal.ts';
import { signupWrites } from '../../support/dsl/workos-signup.ts';
import { hostedRootConfig } from '../../support/fixtures/hosted-config.ts';
import { signupDocuments } from '../../support/fixtures/signup-documents.ts';
import { otherOrganization, removalAdmin, removalOrganization, removalUser, serveMemberRemovalSite } from '../../support/in-process/hosted-member-removal-site.ts';
import { serveWorkOSSite } from '../../support/in-process/workos-site.ts';

for (const status of ['inactive', 'pending'] as const) {
  test(`Given a signed-in person whose only membership is ${status}, when signup opens and an old agreement form is posted, then signup says the account exists, offers the workspace selector, and creates no organization or membership`, async (t) => {
    const site = await serveWorkOSSite(t, {
      config: hostedRootConfig, organizations: ['org_FORMER'], signupFake: true,
      signup: { enabled: true, documents: signupDocuments },
    });
    const user = { id: 'user_FORMER', email: 'former@company.example', firstName: 'Former', emailVerified: true };
    site.world.users = [user];
    site.world.memberships = [{ userId: user.id, organizationId: 'org_FORMER', roles: ['user'], status }];
    const memberships = structuredClone(site.world.memberships);
    const { browser } = await signInThroughServer(site, user);
    const session = JSON.parse((await browser.open('session')).body) as { csrfToken: string };
    signupWrites(site);

    const page = await browser.open('signup');
    const posted = await browser.post('signup', { csrf_token: session.csrfToken, document_version: signupDocuments.version, organization_name: 'Independent Labs', agreement: 'accepted' });

    assert.equal(page.status, 200, page.body);
    assert.equal(posted.status, 403, posted.body);
    for (const answer of [page, posted]) {
      const document = parseHTML(answer.body).document;
      assert.equal(document.querySelector('h1')?.textContent, 'You already have a Thermus account');
      assert.match(document.querySelector('.notice-message')?.textContent ?? '', /cannot create an organization for it/);
      const selector = document.querySelector('.primary-action');
      assert.equal(selector?.textContent, 'Open your workspace');
      assert.equal(selector?.getAttribute('href'), '/organizations?return_to=%2F');
      assert.deepEqual(formsIn(answer.body), []);
      assert.ok(!answer.body.includes(signupDocuments.terms.text));
    }
    assert.deepEqual(site.signupFake.organizations, []);
    assert.deepEqual(site.world.memberships, memberships);
    assert.deepEqual(signupWrites(site), []);
  });
}

test('Given a person whose only membership an Admin removed through Members, when signup opens and an old agreement form is posted, then signup says the account exists and creates no organization or membership', async (t) => {
  const site = await serveMemberRemovalSite(t, { config: hostedRootConfig, setUp: (world) => {
    world.memberships = world.memberships.filter((membership) => !(membership.userId === removalUser.id && membership.organizationId === otherOrganization));
  } });
  const admin = await signInThroughServer(site, removalAdmin, removalOrganization);
  const targetId = site.world.membershipId(removalUser, removalOrganization);
  const removed = await admin.browser.submit(await removalForm(admin.browser, targetId));
  assert.ok(removed.status < 400, removed.body);
  assert.deepEqual([...site.world.deletedMembershipIds], [targetId]);
  assert.deepEqual(site.world.memberships.filter((membership) => membership.userId === removalUser.id).map((membership) => membership.organizationId), [removalOrganization]);
  const { browser } = await signInThroughServer(site, removalUser);
  const session = JSON.parse((await browser.open('session')).body) as { csrfToken: string };
  signupWrites(site);

  const page = await browser.open('signup');
  const posted = await browser.post('signup', { csrf_token: session.csrfToken, document_version: signupDocuments.version, organization_name: 'Independent Labs', agreement: 'accepted' });

  assert.equal(page.status, 200, page.body);
  assert.equal(posted.status, 403, posted.body);
  for (const answer of [page, posted]) {
    const document = parseHTML(answer.body).document;
    assert.equal(document.querySelector('h1')?.textContent, 'You already have a Thermus account');
    assert.equal(document.querySelector('.primary-action')?.getAttribute('href'), '/organizations?return_to=%2F');
    assert.deepEqual(formsIn(answer.body), []);
    assert.ok(!answer.body.includes(signupDocuments.terms.text));
  }
  assert.deepEqual(site.signupFake.organizations, []);
  assert.deepEqual(signupWrites(site), []);
  assert.deepEqual([...site.world.deletedMembershipIds], [targetId]);
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

test('Given current User and Admin memberships, when signup continues through each choice, then both workspaces remain usable without a new organization or agreement', async (t) => {
  const site = await serveWorkOSSite(t, {
    config: hostedRootConfig, organizations: ['org_USER', 'org_ADMIN'], signupFake: true,
    signup: { enabled: true, documents: signupDocuments },
  });
  const user = { id: 'user_MULTIPLE', email: 'member@company.example', firstName: 'Member', emailVerified: true };
  site.world.users = [user];
  site.world.memberships = [{ userId: user.id, organizationId: 'org_USER', roles: ['user'], status: 'active' },
    { userId: user.id, organizationId: 'org_ADMIN', roles: ['admin'], status: 'active' }];
  const memberships = structuredClone(site.world.memberships);
  const { browser } = await signInThroughServer(site, user);
  site.world.fake.takeRequests();

  const signup = await browser.open('signup');
  assert.equal(signup.status, 200, signup.body);
  assert.match(signup.body, /href="\/organizations\?return_to=%2F">Continue<\/a>/);
  assert.deepEqual(formsIn(signup.body), []);
  assert.doesNotMatch(signup.body, /organization_name|name="agreement"/);
  for (const organizationId of ['org_USER', 'org_ADMIN']) {
    const choices = formsIn((await browser.open('organizations?return_to=%2F')).body);
    assert.deepEqual(choices.map(({ fields }) => fields.organization_id).filter(Boolean).sort(), ['org_ADMIN', 'org_USER']);
    const choice = choices.find(({ fields }) => fields.organization_id === organizationId);
    assert.ok(choice);
    assert.equal((await browser.submit(choice)).status, 303);
    const access = await browser.open('portal/access');
    assert.equal(access.status, 200, access.body);
    assert.equal((JSON.parse(access.body) as { organizationId: string }).organizationId, organizationId);
  }
  assert.deepEqual(site.signupFake.organizations, []);
  assert.deepEqual(site.world.memberships, memberships);
  assert.deepEqual(site.world.fake.takeRequests().filter(({ method, path }) => method !== 'GET' && path !== '/user_management/authenticate'), []);
});
