import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadDeploymentConfig } from '../../../src/config/deployment-config.ts';
import { composeWorkOSApplication } from '../../../src/hosted-workos-application.ts';
import { WorkOSFake } from '../../support/doubles/workos/workos-fake.ts';
import { signInThroughServer } from '../../support/dsl/workos-sign-in.ts';

const config = loadDeploymentConfig({ DEPLOYMENT: 'hosted', PUBLIC_BASE_URL: 'https://thermus.example' }, 'http');
const organizationId = 'org_MFA';
const user = { id: 'user_ADMIN', email: 'admin@example.com', firstName: 'Admin' };

for (const policy of [undefined, 'optional', 'required'] as const) {
  test(`Given the normal hosted edition with MFA policy ${policy ?? 'omitted'}, when an Admin signs in with Password, then MFA evidence and administration are ${policy === 'required' ? 'allowed by the explicit Required policy' : 'refused without proof'}`, async (t) => {
    const world = await WorkOSFake.start(t, config.publicBaseUrl, [organizationId]);
    world.users = [user];
    world.memberships = [{ userId: user.id, organizationId, roles: ['admin'] }];
    const connection = world.connection();
    const configured = policy === undefined ? connection : { ...connection, settings: { ...connection.settings, mfaPolicy: policy } };
    const app = await composeWorkOSApplication(config, configured, { logger: { info: () => {}, error: () => {} } });
    t.after(() => app.close());
    const { browser, callback } = await signInThroughServer({ world, transport: app.handle, publicBaseUrl: config.publicBaseUrl }, user, organizationId);
    assert.equal(callback.status, 303, callback.body);
    const session = await browser.open('session', { Accept: 'application/json' });
    assert.equal(JSON.parse(session.body).mfaCompleted, policy === 'required');
    const members = await browser.open('members');
    assert.equal(members.status, policy === 'required' ? 200 : 403);
    if (policy !== 'required') assert.match(members.body, /Administration needs a sign-in that completed multi-factor authentication/);
  });
}
