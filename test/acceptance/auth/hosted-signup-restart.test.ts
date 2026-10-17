import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HostedBrowser, formsIn } from '../../support/drivers/browser/hosted-browser.ts';
import { signInThroughServer } from '../../support/dsl/workos-sign-in.ts';
import { hostedRootConfig } from '../../support/fixtures/hosted-config.ts';
import { signupDocuments } from '../../support/fixtures/signup-documents.ts';
import { serveWorkOSSite } from '../../support/in-process/workos-site.ts';

test('Given a retained activation, when the application restarts with signup off and reopens after revocation, then the old form cannot replay the grant and other workspace access remains usable', async (t) => {
  const enabled = { enabled: true, documents: signupDocuments };
  const site = await serveWorkOSSite(t, {
    config: hostedRootConfig, organizations: ['org_OTHER'], signupFake: true, signup: enabled,
  });
  const user = { id: 'user_RESTART', email: 'person@example.com', firstName: 'Person', emailVerified: true };
  site.world.users = [user];
  const { browser } = await signInThroughServer(site, user);
  const agreement = formsIn((await browser.open('signup')).body).find(({ action }) => action === '/signup');
  assert.ok(agreement);
  const fields = { ...agreement.fields, agreement: 'accepted' };
  const activated = await browser.post('signup', fields);
  assert.equal(activated.status, 303, activated.body);
  assert.equal(site.signupFake.organizations.length, 1);
  const marker = structuredClone(site.signupFake.organizations[0]);
  const personalId = String(marker.id);
  assert.deepEqual(site.world.rolesOf(user, personalId), ['user']);
  const personalSelection = formsIn((await browser.follow(activated)).body)
    .find(({ fields: selection }) => selection.organization_id === personalId);
  assert.ok(personalSelection);
  assert.equal((await browser.submit(personalSelection)).status, 303);
  site.world.memberships = [...site.world.memberships, { userId: user.id, organizationId: 'org_OTHER', roles: ['user'], status: 'active' }];
  const personalToken = await site.world.connectToken(user, { org_id: personalId });
  const otherToken = await site.world.connectToken(user, { org_id: 'org_OTHER' });

  await site.close();
  const closedSite = await serveWorkOSSite(t, {
    config: hostedRootConfig, organizations: [], world: site.world, signup: { enabled: false },
  });
  const closedBrowser = new HostedBrowser(closedSite.transport, closedSite.publicBaseUrl, browser.cookieHeader);
  site.world.fake.takeRequests();
  const closedPage = await closedBrowser.open('signup');
  const closedPost = await closedBrowser.post('signup', fields);
  const closedHead = await closedSite.transport(new Request(new URL('signup', closedSite.publicBaseUrl), { method: 'HEAD' }));
  assert.equal(closedPage.status, 200, closedPage.body);
  assert.match(closedPage.body, /activation is closed/i);
  assert.equal(closedPost.status, 403, closedPost.body);
  assert.equal(closedHead.status, 200);
  assert.equal(await closedHead.text(), '');
  assert.deepEqual(site.world.fake.takeRequests(), []);
  const retainedAccess = await closedBrowser.open('portal/access');
  assert.equal(retainedAccess.status, 200, retainedAccess.body);
  assert.equal((JSON.parse(retainedAccess.body) as { organizationId: string }).organizationId, personalId);
  assert.equal((await closedSite.discover(personalToken)).status, 200);
  assert.deepEqual(site.signupFake.organizations, [marker]);

  await closedSite.close();
  site.world.setStatus(user, personalId, 'inactive');
  const reopenedSite = await serveWorkOSSite(t, {
    config: hostedRootConfig, organizations: [], world: site.world, signup: enabled,
  });
  const reopenedBrowser = new HostedBrowser(reopenedSite.transport, reopenedSite.publicBaseUrl, closedBrowser.cookieHeader);
  site.world.fake.takeRequests();
  const supportPage = await reopenedBrowser.open('signup');
  const replayed = await reopenedBrowser.post('signup', fields);
  assert.equal(supportPage.status, 409, supportPage.body);
  assert.match(supportPage.body, /mailto:legal@thermus.ai/);
  assert.match(supportPage.body, /href="\/organizations\?return_to=%2F">Continue to another workspace<\/a>/);
  assert.deepEqual(formsIn(supportPage.body), []);
  assert.equal(replayed.status, 409, replayed.body);
  assert.match(replayed.body, /support|contact/i);
  assert.deepEqual(site.world.fake.takeRequests().filter(({ method }) => method !== 'GET'), []);
  assert.equal((await reopenedBrowser.open('portal/access')).status, 403);
  assert.equal((await reopenedSite.discover(personalToken)).status, 403);
  assert.equal((await reopenedSite.discover(otherToken)).status, 200);
  const otherSelection = formsIn((await reopenedBrowser.open('organizations?return_to=%2F')).body)
    .find(({ fields: selection }) => selection.organization_id === 'org_OTHER');
  assert.ok(otherSelection);
  assert.equal((await reopenedBrowser.submit(otherSelection)).status, 303);
  const otherAccess = await reopenedBrowser.open('portal/access');
  assert.equal(otherAccess.status, 200, otherAccess.body);
  assert.equal((JSON.parse(otherAccess.body) as { organizationId: string }).organizationId, 'org_OTHER');
  assert.deepEqual(site.signupFake.organizations, [marker]);
  assert.equal(site.world.statusOf(user, personalId), 'inactive');
  assert.deepEqual(site.world.fake.takeRequests().filter(({ method, path }) => method === 'POST'
    && (path === '/organizations' || path === '/user_management/organization_memberships')), []);
});
