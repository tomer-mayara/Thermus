import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formsIn } from '../../support/drivers/browser/hosted-browser.ts';
import { signInThroughServer } from '../../support/dsl/workos-sign-in.ts';
import { removalForm } from '../../support/dsl/hosted-member-removal.ts';
import { otherOrganization, removalAdmin, removalOrganization, removalUser, serveMemberRemovalSite } from '../../support/in-process/hosted-member-removal-site.ts';

for (const path of ['session', 'organizations']) {
  test(`Given a removed membership and an expired selected-workspace session, when the User opens ${path}, then sign-in is required and a new sign-in can select only retained access without replaying removal`, async (t) => {
    const site = await serveMemberRemovalSite(t, { setUp: world => world.expireAccessTokens() });
    const removed = await signInThroughServer(site, removalUser, removalOrganization);
    const admin = await signInThroughServer(site, removalAdmin, removalOrganization);
    const oldToken = await site.world.connectToken(removalUser, { org_id: removalOrganization });
    const targetId = site.world.membershipId(removalUser, removalOrganization);
    const form = await removalForm(admin.browser, targetId);
    assert.equal((await admin.browser.submit(form)).status, 200);
    const receipt = structuredClone(site.removalStore.operations.get(removalOrganization));
    site.world.fake.takeRequests();

    const answer = await removed.browser.open(path);

    assert.equal(answer.status, 401, answer.body);
    assert.ok(answer.cookies.some(cookie => cookie.startsWith('__Host-thermus-session=;') && cookie.includes('Max-Age=0')));
    if (path === 'session') assert.deepEqual(JSON.parse(answer.body), { signedIn: false });
    else assert.match(answer.body, /Sign-in required/);
    assert.equal((await site.discover(oldToken)).status, 403);
    const start = await removed.browser.open('login?return_to=/team/organizations');
    const state = start.location?.searchParams.get('state');
    assert.ok(state);
    const callback = await removed.browser.open(`callback?code=${site.world.codeFor(removalUser)}&state=${encodeURIComponent(state)}`);
    assert.equal(callback.status, 303, callback.body);
    const selector = await removed.browser.follow(callback);
    assert.equal(selector.status, 200, selector.body);
    const choices = formsIn(selector.body);
    assert.deepEqual(choices.map(choice => choice.fields.organization_id), [otherOrganization]);
    assert.equal((await removed.browser.submit(choices[0])).status, 303);
    const access = await removed.browser.open('portal/access');
    assert.equal(access.status, 200, access.body);
    assert.equal(JSON.parse(access.body).organizationId, otherOrganization);
    assert.equal((await site.discover(oldToken)).status, 403);
    assert.deepEqual(site.removalStore.operations.get(removalOrganization), receipt);
    assert.equal(receipt?.outcome, 'applied');
    assert.equal(site.removalStore.admissions.length, 1);
    assert.equal(site.world.fake.takeRequests().filter(request => request.method === 'DELETE').length, 0);
  });
}
