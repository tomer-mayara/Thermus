import assert from 'node:assert/strict';
import { test } from 'node:test';
import { signInThroughServer } from '../../support/dsl/workos-sign-in.ts';
import { serveRequiredMfaSite } from '../../support/in-process/required-mfa-site.ts';

const organizationId = 'org_MFA';
const user = { id: 'user_ADMIN', email: 'admin@example.com', firstName: 'Admin' };

test('Given retained Required MFA settings, when an Admin signs in with a Password callback, then the portal reports no MFA proof', async (t) => {
  const site = await serveRequiredMfaSite(t, user, [organizationId]);
  const { browser, callback } = await signInThroughServer(site, user, organizationId);
  assert.equal(callback.status, 303, callback.body);
  const session = await browser.open('session', { Accept: 'application/json' });
  assert.equal(session.status, 200, session.body);
  assert.equal(JSON.parse(session.body).mfaCompleted, false);
});
