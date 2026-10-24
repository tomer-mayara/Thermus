import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DestinationSettingsService } from '../../../src/logs/audit/destination-settings-service.ts';
import { DestinationSettingsFake } from '../../support/doubles/logging/destination-settings-fake.ts';
import { serveAdministration } from './fixtures/administration-routes-fixtures.ts';
import { accountRequest, serve } from './fixtures/account-routes-fixtures.ts';

for (const method of ['GET', 'HEAD']) {
  test(`Given a password Admin session, when ${method} reads Audit logs, then safe settings and refreshed cookies reach the browser`, async () => {
    const store = new DestinationSettingsFake();
    const service = new DestinationSettingsService(store, Buffer.alloc(32, 8));
    const { routes, failures } = serveAdministration({}, { session: { mfaCompleted: false }, routes: { logging: service } });
    const response = await routes.handle(accountRequest('/logging', 'session=ann', { method }));
    assert.equal(response.status, 200); assert.match(response.headers.get('Set-Cookie')!, /session=refreshed/); assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.match(await response.text(), /Audit log destination/); assert.equal(store.writes, 0); assert.deepEqual(failures, []);
  });
}
test('Given a signed-out session, when Audit logs is requested, then settings are not read and cookie effects are preserved', async () => {
  let reads = 0;
  const { routes } = serve({ otherSession: { status: 'signed-out', cookies: ['session=; Max-Age=0'] }, logging: { read: async () => { reads += 1; return { status: 'unavailable' }; }, save: async () => ({ status: 'unavailable' }) } });
  const response = await routes.handle(accountRequest('/logging'));
  assert.equal(response.status, 401); assert.equal(reads, 0); assert.match(response.headers.get('Set-Cookie')!, /Max-Age=0/);
});
test('Given a secret-bearing collaborator exception, when Audit logs reads fail, then cookies survive and the account reporter gets no cause', async () => {
  const { routes, failures } = serveAdministration({}, { routes: { logging: { read: async () => { throw new Error('private-token'); }, save: async () => ({ status: 'unavailable' }) } } });
  const response = await routes.handle(accountRequest('/logging', 'session=ann'));
  assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /private-token/); assert.match(response.headers.get('Set-Cookie')!, /session=refreshed/); assert.deepEqual(failures, []);
});
