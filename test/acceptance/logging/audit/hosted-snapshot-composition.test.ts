import assert from 'node:assert/strict';
import { test } from 'node:test';
import { serveHostedAuditSnapshotSite } from '../../../support/in-process/hosted-audit-snapshot-site.ts';

const enabled = { endpoint: 'https://private-collector.example/', auth: 'bearer' as const, encryptedCredential: 'private-ciphertext', enabled: true, revision: 'revision-a' };

test('Given cold hosted capture with saved Enable, when an invitation then a later MCP call complete, then both events use shared activity-loaded settings and reach the saved revision', async t => {
  const capture = await serveHostedAuditSnapshotSite(t);
  capture.store.settings.set(capture.tenant(), enabled);
  assert.equal((await capture.invite('cold-trigger@example.com')).status, 303);
  await capture.drainLoads();
  assert.deepEqual(capture.store.reads, [capture.tenant()]);
  assert.deepEqual((await capture.search('later source')).content, [{ type: 'text', text: 'final later source' }]);
  assert.equal(capture.admitted.length, 2);
  assert.ok(capture.admitted.every(item => item.destinationRevision === enabled.revision));
  assert.deepEqual(capture.admitted.map(item => item.event.eventName), ['organization.changed', 'mcp.tool.completed']);
  assert.match(JSON.stringify(capture.admitted[0]), /cold-trigger@example.com/);
  assert.doesNotMatch(JSON.stringify(capture.admitted), /private-collector|private-ciphertext/);
});

test('Given cold hosted capture with saved Enable, when MCP activity loads settings then an invitation completes, then the web action uses that same snapshot without another store read', async t => {
  const capture = await serveHostedAuditSnapshotSite(t);
  capture.store.settings.set(capture.tenant(), enabled);
  assert.deepEqual((await capture.search('cold content')).content, [{ type: 'text', text: 'final cold content' }]);
  await capture.drainLoads();
  assert.equal((await capture.invite('later-admin@example.com')).status, 303);
  assert.deepEqual(capture.store.reads, [capture.tenant()]);
  assert.equal(capture.admitted.length, 2);
  assert.equal(capture.admitted[1].event.eventName, 'organization.changed');
  assert.equal(capture.admitted[1].destinationRevision, enabled.revision);
  assert.match(JSON.stringify(capture.admitted[0]), /final cold content/);
});

test('Given an enabled snapshot in one hosted process, when that process restarts against the saved store, then the new process captures its first and later events with the saved revision', async t => {
  const first = await serveHostedAuditSnapshotSite(t);
  first.store.settings.set(first.tenant(), enabled);
  await first.invite('before-restart@example.com');
  await first.drainLoads();
  await first.search('before restart');
  assert.equal(first.admitted.length, 2);
  await first.site.close();
  const restarted = await serveHostedAuditSnapshotSite(t, first.store);
  await restarted.search('cold restart payload');
  await restarted.drainLoads();
  assert.equal(restarted.admitted.length, 1);
  await restarted.search('after restart');
  assert.equal(restarted.admitted.length, 2);
  assert.ok(restarted.admitted.every(item => item.destinationRevision === enabled.revision));
  assert.match(JSON.stringify(restarted.admitted[0]), /final cold restart payload/);
});

test('Given hosted capture caches disabled settings, when another process enables a new revision, then due and later activity use the refreshed revision without idle reads', async t => {
  const capture = await serveHostedAuditSnapshotSite(t);
  capture.store.settings.set(capture.tenant(), { ...enabled, enabled: false });
  await capture.invite('disabled-trigger@example.com');
  await capture.drainLoads();
  capture.store.settings.set(capture.tenant(), { ...enabled, revision: 'remote-enable' });
  capture.advance(100);
  await capture.drainLoads();
  assert.equal(capture.store.reads.length, 1);
  await capture.search('due disabled content');
  await capture.drainLoads();
  await capture.invite('after-enable@example.com');
  assert.equal(capture.admitted.length, 2);
  assert.ok(capture.admitted.every(item => item.destinationRevision === 'remote-enable'));
  assert.match(JSON.stringify(capture.admitted[0]), /final due disabled content/);
  assert.doesNotMatch(JSON.stringify(capture.admitted), /disabled-trigger/);
});

test('Given an unavailable settings read, when later hosted activity reaches backoff and the store recovers, then public outcomes stay complete and recovery captures new activity without replaying rejected content', async t => {
  const capture = await serveHostedAuditSnapshotSite(t);
  capture.store.settings.set(capture.tenant(), enabled);
  capture.store.unavailable = true;
  await capture.invite('failure-trigger@example.com');
  await capture.drainLoads();
  await capture.search('during backoff');
  assert.equal(capture.store.reads.length, 1);
  capture.store.unavailable = false;
  capture.advance(50);
  await capture.search('recovery trigger');
  await capture.drainLoads();
  await capture.search('future recovered');
  assert.equal(capture.admitted.length, 2);
  assert.match(JSON.stringify(capture.admitted[0]), /final recovery trigger/);
  assert.doesNotMatch(JSON.stringify(capture.admitted), /failure-trigger|during backoff/);
});

test('Given two trusted hosted tenants have different saved revisions, when both call MCP and an Admin acts in A, then each admitted event keeps its own tenant and revision', async t => {
  const capture = await serveHostedAuditSnapshotSite(t);
  const tenantA = capture.tenant();
  const tenantB = capture.tenant('org_SNAPSHOT_B');
  capture.store.settings.set(tenantA, enabled);
  capture.store.settings.set(tenantB, { ...enabled, revision: 'revision-b' });
  await Promise.all([capture.search('cold-a'), capture.search('cold-b', 1)]);
  await capture.drainLoads();
  await Promise.all([capture.search('future-a'), capture.search('future-b', 1)]);
  await capture.invite('admin-a@example.com');
  assert.equal(capture.admitted.length, 5);
  assert.deepEqual(capture.admitted.map(({ destinationRevision, event }) => [event.organizationId, destinationRevision]).sort(), [[tenantA, 'revision-a'], [tenantA, 'revision-a'], [tenantA, 'revision-a'], [tenantB, 'revision-b'], [tenantB, 'revision-b']].sort());
  assert.doesNotMatch(JSON.stringify(capture.admitted.filter(item => item.event.organizationId === tenantB)), /cold-a|future-a|admin-a/);
  assert.doesNotMatch(capture.site.log.lines.join('\n'), /cold-a|cold-b|future-a|future-b|private-ciphertext|private-collector/);
});

test('Given hosted logging storage is unavailable, when MCP and Admin actions complete, then customer capture stays discarded and neither path reads settings', async t => {
  const capture = await serveHostedAuditSnapshotSite(t, false);
  assert.deepEqual((await capture.search('no storage')).content, [{ type: 'text', text: 'final no storage' }]);
  assert.equal((await capture.invite('without-storage@example.com')).status, 303);
  await capture.drainLoads();
  assert.equal(capture.store.reads.length, 0);
  assert.equal(capture.admitted.length, 0);
  assert.doesNotMatch(capture.site.log.lines.join('\n'), /final no storage/);
});

for (const phase of ['startup', 'expiry'] as const) {
  test(`Given enabled settings at ${phase} and a held settings read, when the first MCP search completes, then its complete response returns before audit metadata and its query and result are captured once after release`, { timeout: 5_000 }, async t => {
    const capture = await serveHostedAuditSnapshotSite(t);
    capture.store.settings.set(capture.tenant(), enabled);
    if (phase === 'expiry') {
      await capture.search('earlier request'); await capture.drainLoads();
      capture.admitted.length = 0;
      capture.advance(100);
    }
    const held = Promise.withResolvers<void>();
    t.after(() => held.resolve());
    capture.store.hold = held.promise;
    const query = `first search after ${phase}`;
    const result = await capture.search(query);
    assert.deepEqual(result.content, [{ type: 'text', text: `final ${query}` }]);
    assert.equal(capture.admitted.length, 0);
    held.resolve(); await capture.drainLoads();
    assert.equal(capture.admitted.length, 1);
    const item = capture.admitted[0];
    assert.equal(item.destinationRevision, enabled.revision);
    if (item.event.eventName !== 'mcp.tool.completed' || item.event.tool !== 'search') throw new Error('Expected search audit event');
    assert.equal(item.event.input.query, query);
    assert.equal(item.event.result.text, `final ${query}`);
    assert.ok(item.event.operationId);
    await capture.drainLoads(); assert.equal(capture.admitted.length, 1);
  });
}
