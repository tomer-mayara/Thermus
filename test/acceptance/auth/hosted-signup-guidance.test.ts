import assert from 'node:assert/strict';
import { test } from 'node:test';
import { signInThroughServer } from '../../support/dsl/workos-sign-in.ts';
import { hostedRootConfig } from '../../support/fixtures/hosted-config.ts';
import { serveWorkOSSite } from '../../support/in-process/workos-site.ts';

test('Given a signed-in hosted user with no workspace and signup off, when they open the organization page, then they can check signup availability or follow invitation and support guidance without an automatic grant', async (t) => {
  const site = await serveWorkOSSite(t, { config: hostedRootConfig, organizations: ['org_INTERNAL'], signupFake: true });
  const { browser, callback } = await signInThroughServer(site, { id: 'user_NO_WORKSPACE', email: 'new@example.com', firstName: 'New' });
  assert.equal(callback.status, 303, callback.body);
  site.world.fake.takeRequests();

  const page = await browser.open('organizations');

  assert.equal(page.status, 200, page.body);
  assert.match(page.body, /href="https:\/\/thermus\.example\/signup"/);
  assert.match(page.body, /accept the invitation in the email/);
  assert.match(page.body, /contact the operator/);
  assert.doesNotMatch(page.body, /Only the operator can set up/);
  assert.doesNotMatch(page.body, /<form/);
  const signup = await browser.open('signup');
  assert.equal(signup.status, 200, signup.body);
  assert.match(signup.body, /closed/i);
  assert.deepEqual(site.world.fake.takeRequests().filter(({ method }) => method !== 'GET'), []);
  assert.deepEqual(site.world.memberships, []);
});
