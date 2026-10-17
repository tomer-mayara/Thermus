import assert from 'node:assert/strict';
import { test } from 'node:test';
import { signInThroughServer } from '../../support/dsl/workos-sign-in.ts';
import { hostedRootConfig } from '../../support/fixtures/hosted-config.ts';
import { serveWorkOSSite } from '../../support/in-process/workos-site.ts';

const organizationId = 'org_MFA';
const user = { id: 'user_ADMIN', email: 'admin@example.com', firstName: 'Admin' };

for (const policy of [undefined, 'optional', 'required'] as const) {
  test(`Given the normal hosted edition with MFA policy ${policy ?? 'omitted'}, when an Admin signs in with Password, then MFA evidence and administration are ${policy === 'required' ? 'allowed by the explicit Required policy' : 'refused without proof'}`, async (t) => {
    const site = await serveWorkOSSite(t, {
      config: hostedRootConfig,
      organizations: [organizationId],
      mfaPolicy: policy,
      setUp: (world) => {
        world.users = [user];
        world.memberships = [{ userId: user.id, organizationId, roles: ['admin'] }];
      },
    });
    const { browser, callback } = await signInThroughServer(site, user, organizationId);
    assert.equal(callback.status, 303, callback.body);
    const session = await browser.open('session', { Accept: 'application/json' });
    assert.equal(JSON.parse(session.body).mfaCompleted, policy === 'required');
    const members = await browser.open('members');
    assert.equal(members.status, policy === 'required' ? 200 : 403);
    if (policy !== 'required') assert.match(members.body, /Administration needs a sign-in that completed multi-factor authentication/);
  });
}
