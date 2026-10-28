import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HostedBrowser, formsIn } from '../../support/drivers/browser/hosted-browser.ts';
import { beginOrganizationSignup, restartOrganizationSignup, signupWrites } from '../../support/dsl/workos-signup.ts';
import { hostedRootConfig } from '../../support/fixtures/hosted-config.ts';
import { signupDocuments } from '../../support/fixtures/signup-documents.ts';
import { serveWorkOSSite } from '../../support/in-process/workos-site.ts';

const writes = [
  { name: 'organization', route: 'POST /organizations' },
  { name: 'membership', route: 'POST /user_management/organization_memberships' },
] as const;

test('Given an organization response is lost before persistence, when signup restarts and a new name is submitted, then a confirmed fresh creation can make the first Admin', async (t) => {
  const { site, user, browser, fields } = await beginOrganizationSignup(t);
  let attempted = false;
  site.world.fake.intercept('POST /organizations', async (_request, respond) => {
    if (attempted) return respond();
    attempted = true;
    return 'close';
  });
  signupWrites(site);
  const first = await browser.post('signup', fields);
  assert.equal(first.status, 503, first.body);
  assert.equal(site.signupFake.organizations.length, 0);
  assert.equal(site.world.memberships.length, 0);
  assert.deepEqual(signupWrites(site).map(({ path }) => path), ['/organizations']);

  const restarted = await restartOrganizationSignup(t, site, browser);
  signupWrites(restarted.site);
  const page = await restarted.browser.open('signup');
  assert.equal(page.status, 200, page.body);
  assert.ok(formsIn(page.body).some(({ action }) => action === '/signup'));
  const retry = await restarted.browser.post('signup', { ...fields, organization_name: 'Different Name' });
  assert.equal(retry.status, 303, retry.body);
  assert.equal(site.signupFake.organizations.length, 1);
  assert.equal(site.signupFake.organizations[0].name, 'Different Name');
  assert.deepEqual(site.world.rolesOf(user, String(site.signupFake.organizations[0].id)), ['admin']);
  assert.deepEqual(signupWrites(restarted.site).map(({ path }) => path), ['/organizations', '/user_management/organization_memberships']);
});

const retainedLosses = [
  { write: writes[0], loss: 'after', firstStatus: 409, pageStatus: 409, retryStatus: 409, grants: 0, message: /Contact support/ },
  { write: writes[1], loss: 'before', firstStatus: 409, pageStatus: 409, retryStatus: 409, grants: 1, message: /Contact support/ },
  { write: writes[1], loss: 'after', firstStatus: 303, pageStatus: 200, retryStatus: 303, grants: 1, message: /Continue/ },
] as const;

for (const example of retainedLosses) {
  test(`Given the ${example.write.name} response is lost ${example.loss} persistence with a saved organization, when signup restarts and a different name is submitted, then saved facts stay unchanged and no grant repeats`, async (t) => {
    const { site, browser, fields } = await beginOrganizationSignup(t);
    site.world.fake.intercept(example.write.route, async (_request, respond) => {
      if (example.loss === 'after') await respond();
      return 'close' as const;
    });
    signupWrites(site);
    const first = await browser.post('signup', fields);
    assert.equal(first.status, example.firstStatus, first.body);
    const saved = structuredClone(site.signupFake.organizations);
    const memberships = structuredClone(site.world.memberships);
    const firstWrites = signupWrites(site);
    assert.equal(firstWrites.filter(({ path }) => path === '/organizations').length, 1);
    assert.equal(firstWrites.filter(({ path }) => path === '/user_management/organization_memberships').length, example.grants);

    const restarted = await restartOrganizationSignup(t, site, browser);
    signupWrites(restarted.site);
    const page = await restarted.browser.open('signup');
    const replay = await restarted.browser.post('signup', { ...fields, organization_name: 'Different Name' });
    assert.equal(page.status, example.pageStatus, page.body);
    assert.equal(replay.status, example.retryStatus, replay.body);
    assert.deepEqual(formsIn(page.body), []);
    assert.match(page.body, example.message);
    assert.deepEqual(signupWrites(restarted.site), []);
    assert.deepEqual(site.signupFake.organizations, saved);
    assert.deepEqual(site.world.memberships, memberships);
    assert.equal(site.signupFake.organizations[0].name, 'Acme Labs');
  });
}

for (const write of writes) {
  test(`Given an unconfirmed ${write.name} write completes after its request times out, when a new application reads it, then recovery uses current access without another write`, { timeout: 10_000 }, async (t) => {
    const { site, browser, fields } = await beginOrganizationSignup(t);
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const persisted = Promise.withResolvers<void>();
    t.after(() => release.resolve());
    site.world.fake.intercept(write.route, async (_request, respond) => {
      entered.resolve();
      await release.promise;
      const answer = await respond();
      persisted.resolve();
      return answer;
    });
    signupWrites(site);
    const pending = browser.post('signup', fields);
    await entered.promise;
    const timedOut = await pending;
    assert.equal(timedOut.status, write.name === 'organization' ? 503 : 409, timedOut.body);
    const initialWrites = signupWrites(site);
    assert.equal(initialWrites.filter(({ method, path }) => `${method} ${path}` === write.route).length, 1);
    await site.close();
    release.resolve();
    await persisted.promise;
    const saved = structuredClone(site.signupFake.organizations);
    const memberships = structuredClone(site.world.memberships);
    const restarted = await restartOrganizationSignup(t, site, browser);
    signupWrites(restarted.site);
    const page = await restarted.browser.open('signup');
    const replay = await restarted.browser.post('signup', { ...fields, organization_name: 'Late Retry Name' });
    const hasAccess = write.name === 'membership';
    assert.equal(page.status, hasAccess ? 200 : 409, page.body);
    assert.equal(replay.status, hasAccess ? 303 : 409, replay.body);
    assert.match(page.body, hasAccess ? /Continue/ : /Contact support/);
    assert.deepEqual(formsIn(page.body), []);
    assert.deepEqual(signupWrites(restarted.site), []);
    assert.deepEqual(site.signupFake.organizations, saved);
    assert.deepEqual(site.world.memberships, memberships);
    assert.equal(saved[0].name, 'Acme Labs');
  });
}

test('Given two application instances receive different creation names for one subject, when both provider writes settle, then one organization persists and only its confirmed creator attempts the Admin grant', { timeout: 10_000 }, async (t) => {
  const { site, user, browser, fields } = await beginOrganizationSignup(t);
  const peer = await serveWorkOSSite(t, { config: hostedRootConfig, organizations: [], world: site.world, signup: { enabled: true, documents: signupDocuments } });
  const peerBrowser = new HostedBrowser(peer.transport, peer.publicBaseUrl, browser.cookieHeader);
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const winnerHeld = Promise.withResolvers<void>();
  const releaseWinner = Promise.withResolvers<void>();
  t.after(() => release.resolve());
  t.after(() => releaseWinner.resolve());
  let arrivals = 0;
  const providerStatuses: number[] = [];
  site.world.fake.intercept('POST /organizations', async (_request, respond) => {
    if (++arrivals === 2) entered.resolve();
    await release.promise;
    const answer = await respond();
    assert.equal(typeof answer, 'object');
    if (typeof answer === 'object') {
      providerStatuses.push(answer.status);
      if (answer.status === 201) {
        winnerHeld.resolve();
        await releaseWinner.promise;
      }
    }
    return answer;
  });
  signupWrites(site);
  const first = browser.post('signup', fields);
  const second = peerBrowser.post('signup', { ...fields, organization_name: 'Other Labs' });
  await entered.promise;
  release.resolve();
  await winnerHeld.promise;
  const loser = await Promise.race([first, second]);
  assert.equal(loser.status, 409, loser.body);
  assert.match(loser.body, /Contact support/);
  assert.equal(site.signupFake.organizations.length, 1);
  assert.deepEqual(site.world.memberships, []);
  assert.equal(signupWrites(site).filter(({ path }) => path === '/user_management/organization_memberships').length, 0);
  releaseWinner.resolve();
  const replies = await Promise.all([first, second]);
  assert.deepEqual(replies.map(({ status }) => status).toSorted(), [303, 409]);
  assert.deepEqual(providerStatuses.toSorted(), [201, 400]);
  assert.equal(site.signupFake.organizations.length, 1);
  const saved = structuredClone(site.signupFake.organizations[0]);
  const organizationId = String(saved.id);
  assert.ok(['Acme Labs', 'Other Labs'].includes(String(saved.name)));
  assert.deepEqual(site.world.rolesOf(user, organizationId), ['admin']);
  const grants = signupWrites(site).filter(({ path }) => path === '/user_management/organization_memberships');
  assert.equal(grants.length, 1);
  assert.deepEqual(grants[0].body, { organization_id: organizationId, user_id: user.id, role_slug: 'admin' });

  await peer.close();
  const restarted = await restartOrganizationSignup(t, site, browser);
  signupWrites(restarted.site);
  const replay = await restarted.browser.post('signup', { ...fields, organization_name: 'Race Replay' });
  assert.equal(replay.status, 303, replay.body);
  assert.deepEqual(signupWrites(restarted.site), []);
  assert.deepEqual(site.signupFake.organizations, [saved]);
});

test('Given creation succeeds but its browser organization switch fails, when signup is retried after restart, then the same organization opens without a new grant or acceptance write', async (t) => {
  const { site, browser, fields } = await beginOrganizationSignup(t);
  site.world.refreshOutage = { status: 503, body: { message: 'switch unavailable' } };
  signupWrites(site);
  const first = await browser.post('signup', fields);
  assert.equal(first.status, 503, first.body);
  const saved = structuredClone(site.signupFake.organizations);
  const memberships = structuredClone(site.world.memberships);
  assert.equal(saved.length, 1);
  assert.equal(memberships.length, 1);
  assert.deepEqual(signupWrites(site).map(({ path }) => path), ['/organizations', '/user_management/organization_memberships']);
  site.world.refreshOutage = undefined;
  const restarted = await restartOrganizationSignup(t, site, browser);
  signupWrites(restarted.site);
  const page = await restarted.browser.open('signup');
  const replay = await restarted.browser.post('signup', { ...fields, organization_name: 'Switch Retry' });
  assert.equal(page.status, 200, page.body);
  assert.match(page.body, /Continue/);
  assert.equal(replay.status, 303, replay.body);
  assert.equal(replay.location?.pathname, '/quick-start');
  const access = await restarted.browser.open('portal/access');
  assert.equal(access.status, 200, access.body);
  assert.equal((JSON.parse(access.body) as { organizationId: string }).organizationId, saved[0].id);
  assert.deepEqual(signupWrites(restarted.site), []);
  assert.deepEqual(site.signupFake.organizations, saved);
  assert.deepEqual(site.world.memberships, memberships);
});
