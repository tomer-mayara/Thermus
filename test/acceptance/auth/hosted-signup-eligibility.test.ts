import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HostedBrowser, formsIn } from '../../support/drivers/browser/hosted-browser.ts';
import { signInThroughServer } from '../../support/dsl/workos-sign-in.ts';
import { hostedRootConfig } from '../../support/fixtures/hosted-config.ts';
import { signupDocuments } from '../../support/fixtures/signup-documents.ts';
import { serveWorkOSSite } from '../../support/in-process/workos-site.ts';

test('Given a former invited User without a creation record or current access, when the person accepts named creation, then a new organization gets its first Admin without restoring the old membership', async (t) => {
  const site = await serveWorkOSSite(t, {
    config: hostedRootConfig, organizations: ['org_FORMER'], signupFake: true,
    signup: { enabled: true, documents: signupDocuments },
  });
  const user = { id: 'user_FORMER', email: 'former@company.example', firstName: 'Former', emailVerified: true };
  site.world.users = [user];
  site.world.memberships = [{ userId: user.id, organizationId: 'org_FORMER', roles: ['user'], status: 'inactive' }];
  site.world.invitations = [{ id: 'invitation_OLD', email: user.email, organizationId: 'org_FORMER', roleSlug: 'user', state: 'accepted', expiresAt: '2026-10-01T00:00:00.000Z' }];
  const invitation = structuredClone(site.world.invitations);
  const { browser } = await signInThroughServer(site, user);
  site.world.fake.takeRequests();

  const page = await browser.open('signup');
  assert.equal(page.status, 200, page.body);
  const form = formsIn(page.body).find(({ action }) => action === '/signup');
  assert.ok(form);
  const answer = await browser.post('signup', { ...form.fields, organization_name: 'Independent Labs', agreement: 'accepted' });

  assert.equal(answer.status, 303, answer.body);
  assert.equal(site.signupFake.organizations.length, 1);
  const organization = site.signupFake.organizations[0];
  assert.equal(organization.name, 'Independent Labs');
  assert.deepEqual(site.world.rolesOf(user, String(organization.id)), ['admin']);
  assert.equal(site.world.statusOf(user, 'org_FORMER'), 'inactive');
  assert.deepEqual(site.world.invitations, invitation);
  const writes = site.world.fake.takeRequests().filter(({ method }) => method === 'POST');
  assert.equal(writes.filter(({ path }) => path === '/organizations').length, 1);
  assert.deepEqual(writes.filter(({ path }) => path === '/user_management/organization_memberships').map(({ body }) => body), [
    { organization_id: organization.id, user_id: user.id, role_slug: 'admin' },
  ]);
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
