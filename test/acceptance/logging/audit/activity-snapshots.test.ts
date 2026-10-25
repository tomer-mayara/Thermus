import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeAuditSnapshotSite } from '../../../support/in-process/audit-snapshot-site.ts';

test('Given a cold runtime and enabled saved settings, when trusted activity occurs, then the first event returns without waiting and is captured once with its input and result', async t => {
  const site = composeAuditSnapshotSite(); t.after(site.close);
  const saved = await site.save('tenant-a', true);
  assert.equal(saved.status, 'saved');
  site.activity('tenant-a', 'first search');
  assert.equal(site.admitted.length, 0);
  await site.loadsSettled();
  assert.equal(site.admitted.length, 1);
  const event = site.admitted[0]?.event;
  assert.equal(event?.eventName, 'mcp.tool.completed');
  if (event?.eventName !== 'mcp.tool.completed' || event.tool !== 'search') throw new Error('Expected a search audit event');
  assert.equal(event.input.query, 'first search');
  assert.equal(event.result.text, 'first search');
  site.activity('tenant-a', 'later-content');
  assert.equal(site.admitted.length, 2);
  assert.equal(site.admitted[0]?.event.organizationId, 'tenant-a');
  assert.equal(site.admitted[0]?.destinationRevision, saved.status === 'saved' ? saved.settings.revision : '');
  assert.doesNotMatch(JSON.stringify(site.admitted), /private-collector/);
});

test('Given cached disabled settings and remote Enable, when activity reaches freshness expiry, then refresh captures its triggering event without reviving content observed while disabled', async t => {
  const site = composeAuditSnapshotSite(); t.after(site.close);
  await site.save('tenant-a', false);
  site.activity('tenant-a', 'before-enable');
  await site.loadsSettled();
  const enabled = await site.save('tenant-a', true);
  site.activity('tenant-a', 'disabled-snapshot');
  site.advance(30_000);
  site.activity('tenant-a', 'refresh-trigger');
  assert.equal(site.admitted.length, 0);
  await site.loadsSettled();
  site.activity('tenant-a', 'after-refresh');
  assert.equal(site.admitted.length, 2);
  assert.equal(site.admitted[0]?.event.eventName, 'mcp.tool.completed');
  assert.match(JSON.stringify(site.admitted[0]), /refresh-trigger/);
  assert.equal(site.admitted[0]?.destinationRevision, enabled.status === 'saved' ? enabled.settings.revision : '');
  assert.doesNotMatch(JSON.stringify(site.admitted), /before-enable|disabled-snapshot/);
});

test('Given a failed settings read and later recovery, when only time passes then no reads occur, and later eligible activity recovers future capture', async t => {
  const site = composeAuditSnapshotSite(); t.after(site.close);
  await site.save('tenant-a', true);
  const original = site.store.read.bind(site.store);
  let reads = 0;
  let failed = true;
  t.mock.method(site.store, 'read', async (tenant: string) => { reads++; return failed ? { status: 'unavailable' as const } : original(tenant); });
  site.activity('tenant-a', 'outage');
  await site.loadsSettled();
  assert.equal(reads, 1);
  site.activity('tenant-a', 'backoff');
  await site.loadsSettled();
  assert.equal(reads, 1);
  site.advance(5_000);
  failed = false;
  await site.loadsSettled();
  assert.equal(reads, 1);
  site.activity('tenant-a', 'recovery-trigger');
  await site.loadsSettled();
  site.activity('tenant-a', 'after-recovery');
  assert.equal(reads, 2);
  assert.equal(site.admitted.length, 2);
  assert.doesNotMatch(JSON.stringify(site.admitted), /outage|backoff/);
});


test('Given enabled saved settings and an expired snapshot, when the first later search completes, then its query and result reach the same destination once', async t => {
  const site = composeAuditSnapshotSite(); t.after(site.close);
  const saved = await site.save('tenant-a', true);
  site.activity('tenant-a', 'initial search');
  await site.loadsSettled();
  site.advance(30_000);
  site.activity('tenant-a', 'first after expiry');
  await site.loadsSettled();
  assert.equal(site.admitted.length, 2);
  assert.deepEqual(site.admitted.map(item => item.destinationRevision), [saved.status === 'saved' ? saved.settings.revision : '', saved.status === 'saved' ? saved.settings.revision : '']);
  const event = site.admitted[1]?.event;
  if (event?.eventName !== 'mcp.tool.completed' || event.tool !== 'search') throw new Error('Expected a search audit event');
  assert.equal(event.input.query, 'first after expiry');
  assert.equal(event.result.text, 'first after expiry');
});
