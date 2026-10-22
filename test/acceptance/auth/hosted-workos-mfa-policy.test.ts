import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formLabelled, formsIn, HostedBrowser } from '../../support/drivers/browser/hosted-browser.ts';
import { signInThroughServer } from '../../support/dsl/workos-sign-in.ts';
import { hostedRootConfig } from '../../support/fixtures/hosted-config.ts';
import { legacyMfaSessionCookie } from '../../support/fixtures/legacy-workos-session.ts';
import { serveWorkOSSite } from '../../support/in-process/workos-site.ts';

const organizationId = 'org_MFA';
const otherOrganizationId = 'org_OTHER';
const user = { id: 'user_ADMIN', email: 'admin@example.com', firstName: 'Admin' };

test('Given retained Required MFA settings, when an Admin signs in with a Password callback, then the portal reports no MFA proof', async (t) => {
  const site = await serveWorkOSSite(t, {
    config: hostedRootConfig,
    organizations: [organizationId],
    setUp: (world) => {
      const connection = world.connection();
      world.connection = () => ({ ...connection, settings: { ...connection.settings, mfaPolicy: 'required' } });
      world.users = [user];
      world.memberships = [{ userId: user.id, organizationId, roles: ['admin'] }];
    },
  });
  const { browser, callback } = await signInThroughServer(site, user, organizationId);
  assert.equal(callback.status, 303, callback.body);
  const session = await browser.open('session', { Accept: 'application/json' });
  assert.equal(session.status, 200, session.body);
  assert.equal(JSON.parse(session.body).mfaCompleted, false);
});

for (const transition of ['read', 'refresh', 'organization switch'] as const) {
  test(`Given a retained cookie with inferred MFA proof, when the portal performs a session ${transition}, then the user stays signed in without MFA proof`, async (t) => {
    const site = await serveWorkOSSite(t, {
      config: hostedRootConfig,
      organizations: [organizationId, otherOrganizationId],
      setUp: (world) => {
        const connection = world.connection();
        world.connection = () => ({ ...connection, settings: { ...connection.settings, mfaPolicy: 'required' } });
        world.users = [user];
        world.memberships = [organizationId, otherOrganizationId].map((organizationId) => ({ userId: user.id, organizationId, roles: ['admin'] }));
        if (transition === 'refresh') world.expireAccessTokens();
      },
    });
    const signedIn = await signInThroughServer(site, user, organizationId);
    assert.equal(signedIn.callback.status, 303, signedIn.callback.body);
    const browser = new HostedBrowser(site.transport, site.publicBaseUrl,
      legacyMfaSessionCookie(signedIn.browser.cookieHeader, site.world.settings.cookiePassword));
    if (transition === 'organization switch') {
      const organizations = await browser.open('organizations');
      const selected = await browser.submit(formLabelled(formsIn(organizations.body), otherOrganizationId));
      assert.equal(selected.status, 303, selected.body);
    }
    const session = await browser.open('session', { Accept: 'application/json' });
    assert.equal(session.status, 200, session.body);
    const body = JSON.parse(session.body);
    assert.equal(body.mfaCompleted, false);
    assert.equal(body.organizationId, transition === 'organization switch' ? otherOrganizationId : organizationId);
  });
}
