import assert from 'node:assert/strict';
import { test } from 'node:test';
import { serveHostedAuditSnapshotSite } from '../../../support/in-process/hosted-audit-snapshot-site.ts';

const enabled = { endpoint: 'https://private-collector.example/', auth: 'bearer' as const, encryptedCredential: 'private-ciphertext', enabled: true, revision: 'revision-a' };

test('Given cold hosted capture with saved Enable, when an invitation then a later MCP call complete, then both paths share activity-loaded settings and only future content reaches the saved revision', async t => {
  const capture = await serveHostedAuditSnapshotSite(t);
  capture.store.settings.set(capture.tenant(), enabled);
  assert.equal((await capture.invite('cold-trigger@example.com')).status, 303);
  assert.equal(capture.admitted.length, 0);
  await capture.drainLoads();
  assert.deepEqual(capture.store.reads, [capture.tenant()]);
  assert.deepEqual((await capture.search('later source')).content, [{ type: 'text', text: 'final later source' }]);
  assert.equal(capture.admitted.length, 1);
  assert.equal(capture.admitted[0].destinationRevision, enabled.revision);
  assert.equal(capture.admitted[0].event.eventName, 'mcp.tool.completed');
  assert.doesNotMatch(JSON.stringify(capture.admitted), /cold-trigger|private-collector|private-ciphertext/);
});

test('Given cold hosted capture with saved Enable, when MCP activity loads settings then an invitation completes, then the web action uses that same snapshot without another store read', async t => {
  const capture = await serveHostedAuditSnapshotSite(t);
  capture.store.settings.set(capture.tenant(), enabled);
  assert.deepEqual((await capture.search('cold content')).content, [{ type: 'text', text: 'final cold content' }]);
  assert.equal(capture.admitted.length, 0);
  await capture.drainLoads();
  assert.equal((await capture.invite('later-admin@example.com')).status, 303);
  assert.deepEqual(capture.store.reads, [capture.tenant()]);
  assert.equal(capture.admitted.length, 1);
  assert.equal(capture.admitted[0].event.eventName, 'organization.changed');
  assert.equal(capture.admitted[0].destinationRevision, enabled.revision);
  assert.doesNotMatch(JSON.stringify(capture.admitted), /cold content/);
});

test('Given an enabled snapshot in one hosted process, when that process restarts against the saved store, then the new process drops its cold event and learns only for later activity', async t => {
  const first = await serveHostedAuditSnapshotSite(t);
  first.store.settings.set(first.tenant(), enabled);
  await first.invite('before-restart@example.com');
  await first.drainLoads();
  await first.search('before restart');
  assert.equal(first.admitted.length, 1);
  await first.site.close();
  const restarted = await serveHostedAuditSnapshotSite(t, first.store);
  await restarted.search('cold restart payload');
  assert.equal(restarted.admitted.length, 0);
  await restarted.drainLoads();
  await restarted.search('after restart');
  assert.equal(restarted.admitted.length, 1);
  assert.equal(restarted.admitted[0].destinationRevision, enabled.revision);
  assert.doesNotMatch(JSON.stringify(restarted.admitted), /cold restart payload/);
});

test('Given hosted capture caches disabled settings, when another process enables a new revision, then due activity drops now and later activity uses the refreshed revision without idle reads', async t => {
  const capture = await serveHostedAuditSnapshotSite(t);
  capture.store.settings.set(capture.tenant(), { ...enabled, enabled: false });
  await capture.invite('disabled-trigger@example.com');
  await capture.drainLoads();
  capture.store.settings.set(capture.tenant(), { ...enabled, revision: 'remote-enable' });
  capture.advance(100);
  await capture.drainLoads();
  assert.equal(capture.store.reads.length, 1);
  await capture.search('due disabled content');
  assert.equal(capture.admitted.length, 0);
  await capture.drainLoads();
  await capture.invite('after-enable@example.com');
  assert.equal(capture.admitted.length, 1);
  assert.equal(capture.admitted[0].destinationRevision, 'remote-enable');
  assert.doesNotMatch(JSON.stringify(capture.admitted), /due disabled content|disabled-trigger/);
});

test('Given an unavailable settings read, when later hosted activity reaches backoff and the store recovers, then public outcomes stay complete and only future activity is captured', async t => {
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
  assert.equal(capture.admitted.length, 0);
  await capture.drainLoads();
  await capture.search('future recovered');
  assert.equal(capture.admitted.length, 1);
  assert.doesNotMatch(JSON.stringify(capture.admitted), /failure-trigger|during backoff|recovery trigger/);
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
  assert.equal(capture.admitted.length, 3);
  assert.deepEqual(capture.admitted.map(({ destinationRevision, event }) => [event.organizationId, destinationRevision]).sort(), [[tenantA, 'revision-a'], [tenantA, 'revision-a'], [tenantB, 'revision-b']].sort());
  assert.doesNotMatch(JSON.stringify(capture.admitted.filter(item => item.event.organizationId === tenantB)), /future-a|admin-a/);
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
