import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeAuditCollectorSite } from '../../../support/in-process/audit-collector-site.ts';

test('Given enabled saved settings and a loaded snapshot, when bounded public content is captured, then one authorized event reaches the sender without writing audit content to SQL', async t => {
  const site = composeAuditCollectorSite(); t.after(site.close);
  await site.save('tenant-a');
  site.activity('tenant-a', 'cold-content'); await site.settle();
  assert.equal(site.sent.length, 1);
  assert.match(JSON.stringify(site.sent[0]), /cold-content/);
  const writes = site.store.writes;
  site.activity('tenant-a', 'public-result token=secret-value');
  assert.equal(site.sent.length, 1);
  await site.settle();
  assert.equal(site.sent.length, 2);
  assert.equal(site.sent[1]?.event.organizationId, 'tenant-a');
  assert.match(JSON.stringify(site.sent[1]), /public-result/);
  assert.doesNotMatch(JSON.stringify(site.sent), /secret-value/);
  assert.match(JSON.stringify(site.sent), /REDACTED/);
  assert.equal(site.store.writes, writes);
});

test('Given captured work for a saved revision, when another instance changes settings before authorization, then the old event drops without retargeting', async t => {
  const site = composeAuditCollectorSite(); t.after(site.close);
  await site.save('tenant-a');
  site.activity('tenant-a', 'warm'); await site.settle();
  assert.equal(site.sent.length, 1);
  site.activity('tenant-a', 'old-destination-content');
  await site.save('tenant-a', 'https://new-collector.example/v1/logs');
  await site.settle();
  assert.equal(site.sent.length, 1);
  assert.equal(site.sent[0]?.destination.endpoint, 'https://collector.example/v1/logs');
  assert.match(JSON.stringify(site.sent[0]), /warm/);
  assert.doesNotMatch(JSON.stringify(site.sent), /old-destination-content|new-collector/);
});

test('Given independent enabled tenants, when each captures public content and the collector then closes, then their events stay separate and closed capture sends nothing', async t => {
  const site = composeAuditCollectorSite(); t.after(site.close);
  await site.save('tenant-a'); await site.save('tenant-b');
  site.activity('tenant-a', 'warm-a'); site.activity('tenant-b', 'warm-b'); await site.settle();
  site.activity('tenant-a', 'content-a'); site.activity('tenant-b', 'content-b'); await site.settle();
  assert.equal(site.sent.length, 4);
  assert.deepEqual(site.sent.map(item => item.event.organizationId), ['tenant-a', 'tenant-b', 'tenant-a', 'tenant-b']);
  assert.deepEqual(site.sent.map(item => item.event.eventName === 'mcp.tool.completed' && item.event.tool === 'search' ? item.event.input.query : null), ['warm-a', 'warm-b', 'content-a', 'content-b']);
  site.close(); site.activity('tenant-a', 'closed-content'); await site.settle();
  assert.equal(site.sent.length, 4);
  assert.doesNotMatch(JSON.stringify(site.sent), /closed-content/);
});
