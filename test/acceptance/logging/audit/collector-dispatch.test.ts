import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeAuditCollectorSite } from '../../../support/in-process/audit-collector-site.ts';

test('Given enabled saved settings and a loaded snapshot, when bounded public content is captured, then one authorized event reaches the sender without writing audit content to SQL', async t => {
  const site = composeAuditCollectorSite(); t.after(site.close);
  await site.save('tenant-a');
  site.activity('tenant-a', 'cold-content'); await site.settle();
  const writes = site.store.writes;
  site.activity('tenant-a', 'public-result token=secret-value');
  assert.equal(site.sent.length, 0);
  await site.settle();
  assert.equal(site.sent.length, 1);
  assert.equal(site.sent[0]?.event.organizationId, 'tenant-a');
  assert.doesNotMatch(JSON.stringify(site.sent), /secret-value|cold-content/);
  assert.match(JSON.stringify(site.sent), /REDACTED/);
  assert.equal(site.store.writes, writes);
});

test('Given captured work for a saved revision, when another instance changes settings before authorization, then the old event drops without retargeting', async t => {
  const site = composeAuditCollectorSite(); t.after(site.close);
  await site.save('tenant-a');
  site.activity('tenant-a', 'warm'); await site.settle();
  site.activity('tenant-a', 'old-destination-content');
  await site.save('tenant-a', 'https://new-collector.example/v1/logs');
  await site.settle();
  assert.equal(site.sent.length, 0);
});

test('Given independent enabled tenants, when each captures public content and the collector then closes, then their events stay separate and closed capture sends nothing', async t => {
  const site = composeAuditCollectorSite(); t.after(site.close);
  await site.save('tenant-a'); await site.save('tenant-b');
  site.activity('tenant-a', 'warm-a'); site.activity('tenant-b', 'warm-b'); await site.settle();
  site.activity('tenant-a', 'content-a'); site.activity('tenant-b', 'content-b'); await site.settle();
  assert.equal(site.sent.length, 2);
  assert.deepEqual(site.sent.map(item => item.event.organizationId), ['tenant-a', 'tenant-b']);
  site.close(); site.activity('tenant-a', 'closed-content'); await site.settle();
  assert.equal(site.sent.length, 2);
});
