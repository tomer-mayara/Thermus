import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorkOSFake } from '../../../support/doubles/workos/workos-fake.ts';
import { signInThroughServer } from '../../../support/dsl/workos-sign-in.ts';
import { trustedAdRulesFile } from '../../../support/fixtures/ad-rules.ts';
import { hostedRootConfig } from '../../../support/fixtures/hosted-config.ts';
import { composeWorkSliceApplication } from './auth-workos-mcp-url-fetch.ts';

const organizationId = 'org_SLICE';
const user = { id: 'user_ADMIN', email: 'admin@thermus.ai', firstName: 'Admin' };

for (const method of ['Password', 'GoogleOAuth']) {
  test(`Given the slice with unproven MFA, Required provider settings, and an existing User, Admin, and Super Admin membership, when the user signs in with ${method}, then product access works, the session has no MFA evidence, and administration remains refused`, async (t) => {
    const world = await WorkOSFake.start(t, hostedRootConfig.publicBaseUrl, [organizationId]);
    world.authenticationMethod = method;
    world.users = [user];
    world.memberships = [{ userId: user.id, organizationId, roles: ['user', 'admin', 'super-admin'] }];
    const app = await composeWorkSliceApplication({ config: hostedRootConfig, connection: world.connection('required'), environment: {
      THERMUS_SLICE_ORGANIZATION_ID: organizationId, AD_RULES_FILE: trustedAdRulesFile, LIGHTPANDA_BIN: '/test/lightpanda',
    } }, { info: () => {}, error: () => {} });
    t.after(() => app.close());
    const { browser, callback } = await signInThroughServer({ world, transport: app.handle, publicBaseUrl: hostedRootConfig.publicBaseUrl }, user, organizationId);
    assert.equal(callback.status, 303, callback.body);
    const session = await browser.open('session', { Accept: 'application/json' });
    const access = await browser.open('portal/access', { Accept: 'application/json' });
    assert.equal(JSON.parse(session.body).mfaCompleted, false);
    assert.equal(access.status, 200);
    for (const path of ['members', 'invitations', 'billing']) {
      const denied = await browser.open(path);
      assert.equal(denied.status, 403, path);
      assert.match(denied.body, /Administration needs a sign-in that completed multi-factor authentication/);
    }
    const before = world.memberships;
    const deniedChange = await browser.post('members/grants', {
      organization_id: organizationId, membership_id: world.membershipId(user, organizationId), revision: 'irrelevant',
      role: 'user', action: 'revoke', csrf_token: JSON.parse(session.body).csrfToken,
    });
    assert.equal(deniedChange.status, 404);
    assert.deepEqual(world.memberships, before);
  });
}
