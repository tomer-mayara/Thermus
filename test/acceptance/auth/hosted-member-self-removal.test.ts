import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formsIn } from '../../support/drivers/browser/hosted-browser.ts';
import { signInThroughServer } from '../../support/dsl/workos-sign-in.ts';
import { removalForm } from '../../support/dsl/hosted-member-removal.ts';
import { otherOrganization, remainingAdmin, removalAdmin, removalOrganization, serveMemberRemovalSite } from '../../support/in-process/hosted-member-removal-site.ts';

test('Given an Admin with another eligible membership, when the Admin removes itself and follows workspace guidance, then old organization browser and MCP access are refused and the other workspace can be selected', async (t) => {
  const site = await serveMemberRemovalSite(t, { setUp: world => {
    world.memberships = [...world.memberships, { userId: removalAdmin.id, organizationId: otherOrganization, roles: ['user'], directoryManaged: false }];
  } });
  const { browser } = await signInThroughServer(site, removalAdmin, removalOrganization);
  const oldToken = await site.world.connectToken(removalAdmin, { org_id: removalOrganization });
  const otherToken = await site.world.connectToken(removalAdmin, { org_id: otherOrganization });
  const form = await removalForm(browser, site.world.membershipId(removalAdmin, removalOrganization));
  assert.equal((await site.discover(oldToken)).status, 200);

  const answer = await browser.submit(form);

  assert.equal(answer.status, 200, answer.body);
  assert.match(answer.body, /href="\/team\/organizations/);
  assert.deepEqual(formsIn(answer.body), []);
  assert.equal((await browser.open('members')).status, 403);
  assert.equal((await browser.open('portal/access')).status, 403);
  assert.equal((await site.discover(oldToken)).status, 403);
  assert.equal((await site.discover(otherToken)).status, 200);
  const selector = await browser.open('organizations');
  assert.equal(selector.status, 200, selector.body);
  assert.deepEqual(formsIn(selector.body).map(form => form.fields.organization_id), [otherOrganization]);
  assert.doesNotMatch(selector.body, /membership_id|revision|Removal not confirmed|Member removed/);
  assert.equal((await browser.submit(formsIn(selector.body)[0])).status, 303);
  const access = await browser.open('portal/access');
  assert.equal(access.status, 200, access.body);
  assert.equal(JSON.parse(access.body).organizationId, otherOrganization);
});

test('Given an invited Admin without another membership or creator record, when the Admin removes itself and follows guidance, then no-membership invitation and eligible signup are usable without restoring access', async (t) => {
  const site = await serveMemberRemovalSite(t);
  const { browser } = await signInThroughServer(site, removalAdmin, removalOrganization);
  const oldToken = await site.world.connectToken(removalAdmin, { org_id: removalOrganization });
  const answer = await browser.submit(await removalForm(browser, site.world.membershipId(removalAdmin, removalOrganization)));

  assert.equal(answer.status, 200, answer.body);
  const selector = await browser.open('organizations');
  assert.equal(selector.status, 200, selector.body);
  assert.match(selector.body, /accept the invitation in the email/);
  assert.match(selector.body, /Check free signup availability/);
  assert.deepEqual(formsIn(selector.body), []);
  const signup = await browser.open('signup');
  assert.equal(signup.status, 200, signup.body);
  assert.match(signup.body, /name="organization_name"/);
  assert.equal((await browser.open('portal/access')).status, 403);
  assert.equal((await site.discover(oldToken)).status, 403);
  assert.deepEqual(site.signupFake.organizations, []);
});

test('Given a creator Admin with a retained start record and another Admin, when the creator removes itself, then signup offers saved-start support without making or restoring a membership', async (t) => {
  const creator = { id: 'user_CREATOR', email: 'creator@example.com', firstName: 'Creator' };
  const site = await serveMemberRemovalSite(t, { setUp: world => { world.users = [...world.users, creator]; } });
  const signedIn = await signInThroughServer(site, creator);
  const signup = formsIn((await signedIn.browser.open('signup')).body).find(form => form.action === '/team/signup');
  assert.ok(signup);
  assert.equal((await signedIn.browser.post('signup', { ...signup.fields, organization_name: 'Created Labs', agreement: 'accepted' })).status, 303);
  const saved = structuredClone(site.signupFake.organizations);
  const organizationId = String(saved[0]?.id);
  site.world.memberships = [
    ...site.world.memberships.map(member => member.organizationId === organizationId ? { ...member, directoryManaged: false } : member),
    { userId: remainingAdmin.id, organizationId, roles: ['admin'], directoryManaged: false },
  ];
  const { browser } = await signInThroughServer(site, creator, organizationId);
  const oldToken = await site.world.connectToken(creator, { org_id: organizationId });
  const form = await removalForm(browser, site.world.membershipId(creator, organizationId));

  const answer = await browser.submit(form);
  site.world.fake.takeRequests();
  const selector = await browser.open('organizations');
  const recovery = await browser.open('signup');

  assert.equal(answer.status, 200, answer.body);
  assert.equal(selector.status, 200, selector.body);
  assert.match(selector.body, /Check free signup availability/);
  assert.equal(recovery.status, 409, recovery.body);
  assert.match(recovery.body, /Contact support/);
  assert.deepEqual(formsIn(recovery.body), []);
  assert.equal((await browser.open('portal/access')).status, 403);
  assert.equal((await site.discover(oldToken)).status, 403);
  assert.deepEqual(site.signupFake.organizations, saved);
  assert.deepEqual(site.world.fake.takeRequests().filter(request => request.method !== 'GET'), []);
});

test('Given a provider that requires reauthentication after self-removal, when the Admin uses sign-in guidance, then the new identity-only selection offers current no-membership guidance without protected removal details', async (t) => {
  const site = await serveMemberRemovalSite(t, { setUp: world => world.expireAccessTokens() });
  const { browser } = await signInThroughServer(site, removalAdmin, removalOrganization);
  const oldToken = await site.world.connectToken(removalAdmin, { org_id: removalOrganization });
  const form = await removalForm(browser, site.world.membershipId(removalAdmin, removalOrganization));
  const answer = await browser.submit(form);
  site.world.endSessionsOf(removalAdmin);

  assert.equal(answer.status, 200, answer.body);
  const signInLink = /href="([^\"]*\/login[^\"]*)"/.exec(answer.body)?.[1];
  assert.ok(signInLink, 'Removal guidance must offer sign-in');
  assert.equal((await browser.open('organizations')).status, 401);
  assert.equal((await site.discover(oldToken)).status, 403);
  const start = await browser.open(signInLink);
  const state = start.location?.searchParams.get('state');
  assert.ok(state);
  const callback = await browser.open(`callback?code=${site.world.codeFor(removalAdmin)}&state=${encodeURIComponent(state)}`);
  assert.equal(callback.location?.pathname, '/team/organizations');
  const selector = await browser.follow(callback);
  assert.equal(selector.status, 200, selector.body);
  assert.match(selector.body, /accept the invitation in the email/);
  assert.deepEqual(formsIn(selector.body), []);
  assert.doesNotMatch(selector.body, /membership_id|revision|Member removed|not confirmed/);
  assert.equal((await browser.open('portal/access')).status, 403);
});

test('Given an unknown self-removal that took effect, when old POST and Members are refused, then identity-only guidance remains usable and the pending operation is not settled or replayed', async (t) => {
  const site = await serveMemberRemovalSite(t);
  const { browser } = await signInThroughServer(site, removalAdmin, removalOrganization);
  const targetId = site.world.membershipId(removalAdmin, removalOrganization);
  const form = await removalForm(browser, targetId);
  site.world.fake.answer(`DELETE /user_management/organization_memberships/${targetId}`, () => { site.world.deletedMembershipIds.add(targetId); return 'close'; });
  site.world.fake.takeRequests();

  const unknown = await browser.submit(form);
  const held = structuredClone(site.removalStore.operations.get(removalOrganization));
  const repeated = await browser.submit(form);
  const denied = await browser.open('members');
  const guidance = await browser.open('organizations');

  assert.equal(unknown.status, 503, unknown.body);
  assert.match(unknown.body, /href="\/team\/organizations/);
  assert.deepEqual(formsIn(unknown.body), []);
  assert.equal(repeated.status, 403);
  assert.equal(denied.status, 403);
  assert.doesNotMatch(denied.body, /not confirmed|membership_id|revision/);
  assert.equal(guidance.status, 200, guidance.body);
  assert.match(guidance.body, /accept the invitation in the email/);
  assert.deepEqual(site.removalStore.operations.get(removalOrganization), held);
  assert.equal(held?.outcome, null);
  assert.equal(site.world.fake.takeRequests().filter(request => request.method === 'DELETE').length, 1);
});
