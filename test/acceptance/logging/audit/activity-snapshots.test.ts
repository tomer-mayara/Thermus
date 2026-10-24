import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeAuditSnapshotSite } from '../../../support/in-process/audit-snapshot-site.ts';

test('Given a cold runtime and enabled saved settings, when trusted activity occurs, then the first event drops without waiting and only later content uses its loaded revision', async t => {
  const site = composeAuditSnapshotSite(); t.after(site.close);
  const saved = await site.save('tenant-a', true);
  assert.equal(saved.status, 'saved');
  site.activity('tenant-a', 'cold-content-must-drop');
  assert.equal(site.admitted.length, 0);
  await site.loadsSettled();
  site.activity('tenant-a', 'later-content');
  assert.equal(site.admitted.length, 1);
  assert.equal(site.admitted[0]?.event.organizationId, 'tenant-a');
  assert.equal(site.admitted[0]?.destinationRevision, saved.status === 'saved' ? saved.settings.revision : '');
  assert.doesNotMatch(JSON.stringify(site.admitted), /cold-content|private-collector/);
});

test('Given cached disabled settings and remote Enable, when activity reaches freshness expiry, then refresh enables future events without reviving old content', async t => {
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
  assert.equal(site.admitted.length, 1);
  assert.equal(site.admitted[0]?.destinationRevision, enabled.status === 'saved' ? enabled.settings.revision : '');
  assert.doesNotMatch(JSON.stringify(site.admitted), /before-enable|disabled-snapshot|refresh-trigger/);
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
  assert.equal(site.admitted.length, 1);
  assert.doesNotMatch(JSON.stringify(site.admitted), /outage|backoff|recovery-trigger/);
});
