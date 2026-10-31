import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DestinationSettingsService } from '../../../src/logs/audit/destination-settings-service.ts';
import type { DestinationTestSender } from '../../../src/logs/audit/destination-test.ts';
import { DestinationSettingsFake } from '../../support/doubles/logging/destination-settings-fake.ts';
import { serveAdministration } from './fixtures/administration-routes-fixtures.ts';
import { accountRequest, serve } from './fixtures/account-routes-fixtures.ts';

const senderStub: DestinationTestSender = { send: async () => { throw new Error('Read and Save must not send.'); } };

for (const method of ['GET', 'HEAD']) {
  test(`Given a password Admin session, when ${method} reads Audit logs, then safe settings and refreshed cookies reach the browser`, async () => {
    const store = new DestinationSettingsFake();
    const service = new DestinationSettingsService(store, Buffer.alloc(32, 8), senderStub);
    const { routes, failures } = serveAdministration({}, { session: { mfaCompleted: false }, routes: { logging: service } });
    const response = await routes.handle(accountRequest('/logging', 'session=ann', { method }));
    assert.equal(response.status, 200); assert.match(response.headers.get('Set-Cookie') ?? '', /session=refreshed/); assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.match(await response.text(), /Audit log destination/); assert.equal(store.writes, 0); assert.deepEqual(failures, []);
  });
}
test('Given a signed-out session, when Audit logs is requested, then settings are not read and cookie effects are preserved', async () => {
  let reads = 0;
  const { routes } = serve({ otherSession: { status: 'signed-out', cookies: ['session=; Max-Age=0'] }, logging: { read: async () => { reads += 1; return { status: 'unavailable' }; }, save: async () => ({ status: 'unavailable' }) } });
  const response = await routes.handle(accountRequest('/logging'));
  assert.equal(response.status, 401); assert.equal(reads, 0); assert.match(response.headers.get('Set-Cookie') ?? '', /Max-Age=0/);
});
test('Given a secret-bearing collaborator exception, when Audit logs reads fail, then cookies survive and the account reporter gets no cause', async () => {
  const { routes, failures } = serveAdministration({}, { routes: { logging: { read: async () => { throw new Error('private-token'); }, save: async () => ({ status: 'unavailable' }) } } });
  const response = await routes.handle(accountRequest('/logging', 'session=ann'));
  assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /private-token/); assert.match(response.headers.get('Set-Cookie') ?? '', /session=refreshed/); assert.deepEqual(failures, []);
});

test('Given password Admin access, when Test runs through account routes, then the fresh trusted context supplies tenant and actor and refreshed cookies survive', async () => {
  const store = new DestinationSettingsFake();
  const sent: unknown[] = [];
  const service = new DestinationSettingsService(store, Buffer.alloc(32, 8), { send: async (destination, event) => { sent.push({ destination, event }); return { kind: 'accepted' }; } });
  await service.save('tenant-org-a', { expectedRevision: null, endpoint: 'https://collector.example/v1/logs', auth: 'bearer', token: 'saved-token', enabled: false });
  const saved = await service.read('tenant-org-a'); assert.equal(saved.status, 'found');
  if (saved.status !== 'found') return;
  const revision = saved.settings.revision; assert.ok(revision);
  const { routes, failures, resolver } = serveAdministration({}, { session: { mfaCompleted: false }, routes: { logging: service } });
  const response = await routes.handle(accountRequest('/logging/test', 'session=ann', {
    method: 'POST', headers: { Origin: 'https://thermus.example', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ csrf_token: 'csrf-token-of-user-ann', organization_id: 'tenant-org-a', expected_revision: revision, endpoint: saved.settings.endpoint, destination: 'custom', auth: 'bearer', token: '' }),
  }));
  assert.equal(response.status, 200);
  assert.equal(resolver.calls.length, 1);
  assert.equal(sent.length, 1);
  assert.match(JSON.stringify(sent), /"subject":"user-ann"/);
  assert.match(JSON.stringify(sent), /"organizationId":"tenant-org-a"/);
  assert.match(response.headers.get('Set-Cookie') ?? '', /session=refreshed/);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(store.writes, 2);
  assert.deepEqual(failures, []);
});

test('Given an old Admin form, when current access no longer grants Admin, then Test gets no read or send', async () => {
  let tests = 0;
  const { routes, resolver } = serveAdministration({}, { routes: { logging: {
    read: async () => { throw new Error('Test must not read'); }, save: async () => ({ status: 'unavailable' }),
    test: async () => { tests += 1; return { status: 'unavailable' }; },
  }, decisions: new Map([['user-ann', { allowed: true, context: { user: { authority: 'current', subject: 'user-ann' }, tenantId: 'tenant-org-a', organizationId: 'org-a', grants: [], permissions: ['product:access'] } }]]) } });
  const response = await routes.handle(accountRequest('/logging/test', 'session=ann', { method: 'POST' }));
  assert.equal(response.status, 403);
  assert.equal(resolver.calls.length, 1);
  assert.equal(tests, 0);
  assert.match(response.headers.get('Set-Cookie') ?? '', /session=refreshed/);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('Given a secret-bearing Test failure, when account routes answer, then cookies survive and the failure reporter gets no cause', async () => {
  const { routes, failures } = serveAdministration({}, { routes: { logging: {
    read: async () => ({ status: 'unavailable' }), save: async () => ({ status: 'unavailable' }), test: async () => { throw new Error('private-token raw-receiver-diagnostic'); },
  } } });
  const response = await routes.handle(accountRequest('/logging/test', 'session=ann', {
    method: 'POST', headers: { Origin: 'https://thermus.example', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ csrf_token: 'csrf-token-of-user-ann', organization_id: 'tenant-org-a', expected_revision: 'r1', endpoint: 'https://collector.example/v1/logs', destination: 'custom', auth: 'bearer', token: '' }),
  }));
  assert.equal(response.status, 503);
  assert.match(response.headers.get('Set-Cookie') ?? '', /session=refreshed/);
  assert.doesNotMatch(await response.text(), /private-token|raw-receiver-diagnostic/);
  assert.deepEqual(failures, []);
});
