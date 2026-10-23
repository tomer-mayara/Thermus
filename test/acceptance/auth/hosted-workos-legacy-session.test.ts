import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formLabelled, formsIn, HostedBrowser } from '../../support/drivers/browser/hosted-browser.ts';
import { signInThroughServer } from '../../support/dsl/workos-sign-in.ts';
import { legacyMfaSessionCookie } from '../../support/fixtures/legacy-workos-session.ts';
import { serveRequiredMfaSite } from '../../support/in-process/required-mfa-site.ts';
import type { WorkOSSite } from '../../support/in-process/workos-site.ts';

const organizationId = 'org_MFA';
const otherOrganizationId = 'org_OTHER';
const user = { id: 'user_ADMIN', email: 'admin@example.com', firstName: 'Admin' };

async function retainedSessionBrowser(site: WorkOSSite): Promise<HostedBrowser> {
  const signedIn = await signInThroughServer(site, user, organizationId);
  assert.equal(signedIn.callback.status, 303, signedIn.callback.body);
  return new HostedBrowser(site.transport, site.publicBaseUrl,
    legacyMfaSessionCookie(signedIn.browser.cookieHeader, site.world.settings.cookiePassword));
}

for (const transition of ['read', 'refresh'] as const) {
  test(`Given a retained cookie with inferred MFA proof, when the portal performs a session ${transition}, then the user stays signed in without MFA proof`, async (t) => {
    const site = await serveRequiredMfaSite(t, user, [organizationId, otherOrganizationId]);
    if (transition === 'refresh') site.world.expireAccessTokens();
    const browser = await retainedSessionBrowser(site);
    const session = await browser.open('session', { Accept: 'application/json' });
    assert.equal(session.status, 200, session.body);
    const body = JSON.parse(session.body);
    assert.equal(body.mfaCompleted, false);
    assert.equal(body.organizationId, organizationId);
  });
}

test('Given a retained cookie with inferred MFA proof, when the portal performs a session organization switch, then the user stays signed in without MFA proof', async (t) => {
  const site = await serveRequiredMfaSite(t, user, [organizationId, otherOrganizationId]);
  const browser = await retainedSessionBrowser(site);
  const organizations = await browser.open('organizations');
  const selected = await browser.submit(formLabelled(formsIn(organizations.body), otherOrganizationId));
  assert.equal(selected.status, 303, selected.body);
  const session = await browser.open('session', { Accept: 'application/json' });
  assert.equal(session.status, 200, session.body);
  const body = JSON.parse(session.body);
  assert.equal(body.mfaCompleted, false);
  assert.equal(body.organizationId, otherOrganizationId);
});
