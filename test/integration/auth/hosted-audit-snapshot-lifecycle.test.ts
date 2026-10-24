import assert from 'node:assert/strict';
import { AuditSnapshots } from '../../../src/logs/audit/audit-snapshots.ts';
import { test } from 'node:test';
import { serveHostedAuditSnapshotSite } from '../../support/in-process/hosted-audit-snapshot-site.ts';

test('Given an in-flight settings load, when the hosted application closes and its store settles later, then storage closes once and the late result admits no old content', async t => {
  const closed: string[] = [];
  const closeSnapshots = AuditSnapshots.prototype.close;
  t.mock.method(AuditSnapshots.prototype, 'close', function(this: AuditSnapshots) { closed.push('snapshots'); closeSnapshots.call(this); });
  const capture = await serveHostedAuditSnapshotSite(t);
  const closeStore = capture.store.close.bind(capture.store);
  t.mock.method(capture.store, 'close', () => { closed.push('store'); closeStore(); });
  const held = Promise.withResolvers<void>();
  capture.store.hold = held.promise;
  capture.store.settings.set(capture.tenant(), { endpoint: 'https://collector.example/', auth: 'none', encryptedCredential: null, enabled: true, revision: 'late-revision' });
  const outcome = await capture.search('private late trigger');
  assert.deepEqual(outcome.content, [{ type: 'text', text: 'final private late trigger' }]);
  await capture.store.started.promise;
  await capture.site.close();
  assert.equal(capture.store.closes, 1);
  assert.deepEqual(closed, ['snapshots', 'store']);
  held.resolve();
  await capture.drainLoads();
  assert.equal(capture.admitted.length, 0);
  await capture.site.close();
  assert.equal(capture.store.closes, 1);
});

test('Given hosted provider composition fails after snapshot creation, when the failure reaches the caller, then the new snapshot owner closes and storage stays with its caller', async t => {
  const { composeWorkOSApplication } = await import('../../../src/app/hosted-workos-application.ts');
  const { WorkOSFake } = await import('../../support/doubles/workos/workos-fake.ts');
  const { SnapshotSettingsStoreSpy } = await import('../../support/doubles/logging/snapshot-settings-store-spy.ts');
  const { hostedConfig } = await import('../../support/fixtures/hosted-config.ts');
  const world = await WorkOSFake.start(t, hostedConfig.publicBaseUrl, []);
  const connection = world.connection();
  const failure = new Error('provider composition failed');
  const store = new SnapshotSettingsStoreSpy();
  let snapshotsClosed = 0;
  const closeSnapshots = AuditSnapshots.prototype.close;
  t.mock.method(AuditSnapshots.prototype, 'close', function(this: AuditSnapshots) { snapshotsClosed++; closeSnapshots.call(this); });
  const workos = new Proxy(connection.workos, { get: (target, key, receiver) => {
    if (key === 'userManagement') throw failure;
    return Reflect.get(target, key, receiver);
  } });
  await assert.rejects(composeWorkOSApplication(hostedConfig, { ...connection, workos }, {
    logger: { info: () => {}, error: () => {} }, loggingStorage: { store, close: async () => { store.close(); } },
  }), failure);
  assert.equal(snapshotsClosed, 1);
  assert.equal(store.closes, 0);
});
