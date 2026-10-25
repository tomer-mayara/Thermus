import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RevisionBoundAuditEvent } from '../../../../src/logs/audit/audit-snapshots.ts';
import { hostedConfig } from '../../../support/fixtures/hosted-config.ts';
import { SnapshotSettingsStoreSpy } from '../../../support/doubles/logging/snapshot-settings-store-spy.ts';
import { serveHostedAuditExportSite } from '../../../support/in-process/hosted-audit-export-site.ts';
import { serveHostedAuditSnapshotSite } from '../../../support/in-process/hosted-audit-snapshot-site.ts';

test('Given hosted storage owns customer dispatch, when cold activity loads settings and a later tool completes, then the shared capture path admits both final results to that dispatcher without changing the tool response', { timeout: 10_000 }, async t => {
  const store = new SnapshotSettingsStoreSpy();
  const queued: RevisionBoundAuditEvent[] = [];
  const dispatch = { admit: (item: RevisionBoundAuditEvent) => { queued.push(item); return true; }, close: () => {} };
  const storage = { store, dispatch, close: async () => { dispatch.close(); store.close(); } };
  const site = await serveHostedAuditSnapshotSite(t, store, { loggingStorage: storage, auditSink: null });
  store.settings.set(site.tenant(), { endpoint: 'https://collector.example/', auth: 'none', encryptedCredential: null, enabled: true, revision: 'saved-export-revision' });
  await site.search('cold export trigger');
  await site.drainLoads();
  assert.equal(queued.length, 1);
  assert.match(JSON.stringify(queued[0]), /final cold export trigger/);
  assert.deepEqual((await site.search('future export content')).content, [{ type: 'text', text: 'final future export content' }]);
  assert.equal(queued.length, 2);
  assert.ok(queued.every(item => item.destinationRevision === 'saved-export-revision' && item.event.organizationId === site.tenant()));
  assert.match(JSON.stringify(queued[1]), /final future export content/);
  assert.equal(store.writes, 0);
  assert.doesNotMatch(site.site.log.lines.join('\n'), /future export content/);
});

test('Given enabled hosted export, when a tool and an invitation complete, then the production capture and dispatch assembly exports their redacted final customer events without writing event content to settings', { timeout: 10_000 }, async t => {
  const site = await serveHostedAuditExportSite(t);
  await site.enable();
  await site.search('first token=first-private-token');
  await site.sender.untilAttempts(1); await site.drainLoads();
  const readsBefore = site.store.reads.length;
  assert.deepEqual((await site.search('Find token=private-token')).content, [{ type: 'text', text: 'final Find token=private-token' }]);
  await site.sender.untilAttempts(2);
  await site.invite('exported-invitation@example.com');
  await site.sender.untilAttempts(3);
  assert.deepEqual(site.sender.attempts.map(attempt => attempt.event.eventName), ['mcp.tool.completed', 'mcp.tool.completed', 'organization.changed']);
  const searches = site.sender.attempts.filter(attempt => attempt.event.eventName === 'mcp.tool.completed');
  assert.deepEqual(searches.map(attempt => attempt.event.eventName === 'mcp.tool.completed' && attempt.event.tool === 'search' ? attempt.event.input.query : null), ['first token="[REDACTED]"', 'Find token="[REDACTED]"']);
  assert.equal(site.sender.attempts[0].event.organizationId, site.tenant());
  assert.equal(site.store.reads.length - readsBefore, 2);
  assert.equal(site.store.writes, 1);
  assert.doesNotMatch(JSON.stringify(site.sender.attempts), /private-token/);
  assert.doesNotMatch(site.site.log.lines.join('\n'), /private-token|final Find/);
});

test('Given queued hosted content for a saved revision, when another instance replaces that revision before the attempt read finishes, then the old event is dropped without retargeting', { timeout: 10_000 }, async t => {
  const site = await serveHostedAuditExportSite(t);
  await site.enable();
  await site.search('startup before replacement');
  await site.sender.untilAttempts(1); await site.drainLoads();
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  t.after(() => release.resolve());
  const read = site.store.read.bind(site.store);
  t.mock.method(site.store, 'read', async (tenant: string) => { started.resolve(); await release.promise; return read(tenant); });
  assert.deepEqual((await site.search('old revision payload')).content, [{ type: 'text', text: 'final old revision payload' }]);
  await started.promise;
  const saved = site.store.settings.get(site.tenant());
  assert.ok(saved);
  site.store.settings.set(site.tenant(), { ...saved, endpoint: 'https://new-collector.example/v1/logs', revision: 'remote-replacement' });
  release.resolve(); await site.drainLoads();
  assert.equal(site.sender.attempts.length, 1);
  assert.match(JSON.stringify(site.sender.attempts[0]), /startup before replacement/);
  assert.doesNotMatch(JSON.stringify(site.sender.attempts), /old revision payload|new-collector/);
  assert.equal(site.store.writes, 1);
});

test('Given a stalled customer export and more calls than tenant queue capacity, when tools and an Admin invitation complete and the app closes, then product results remain usable and shutdown cancels export before storage closes', { timeout: 10_000 }, async t => {
  const site = await serveHostedAuditExportSite(t);
  await site.enable();
  site.sender.held = true;
  await site.search('first held export'); await site.sender.untilAttempts(1);
  const outcomes = await Promise.all(Array.from({ length: 32 }, (_, index) => site.search(`tool-${index}`)));
  assert.ok(outcomes.every((outcome, index) => JSON.stringify(outcome.content) === JSON.stringify([{ type: 'text', text: `final tool-${index}` }])));
  assert.equal((await site.invite('during-outage@example.com')).status, 303);
  assert.equal((await site.site.transport(new Request(hostedConfig.resourceMetadataUrl))).status, 200);
  await site.site.close();
  assert.equal(site.sender.attempts[0].signal?.aborted, true);
  assert.equal(site.store.closes, 1);
  site.sender.attempts[0].complete(); await site.drainLoads();
  assert.equal(site.sender.attempts.length, 1);
  assert.equal(site.store.writes, 1);
});

test('Given enabled snapshots and an unavailable dispatch settings read, when MCP and Admin work completes, then no new export starts and their public results stay complete', { timeout: 10_000 }, async t => {
  const site = await serveHostedAuditExportSite(t);
  await site.enable(); await site.search('startup before outage');
  await site.sender.untilAttempts(1); await site.drainLoads();
  site.store.unavailable = true;
  assert.deepEqual((await site.search('outage result')).content, [{ type: 'text', text: 'final outage result' }]);
  assert.equal((await site.invite('settings-outage@example.com')).status, 303);
  await site.drainLoads();
  assert.equal(site.sender.attempts.length, 1);
  assert.match(JSON.stringify(site.sender.attempts[0]), /startup before outage/);
  assert.doesNotMatch(JSON.stringify(site.sender.attempts), /outage result|settings-outage/);
  await site.site.close();
  assert.equal(site.store.closes, 1);
});

test('Given one held export and queued content for the old revision, when public activity refreshes remotely disabled settings, then the shared snapshot owner cancels old export and late sender success starts no retry', { timeout: 10_000 }, async t => {
  const site = await serveHostedAuditExportSite(t);
  await site.enable();
  site.sender.held = true;
  await site.search('old active content'); await site.sender.untilAttempts(1);
  await site.search('old queued content');
  const saved = site.store.settings.get(site.tenant());
  assert.ok(saved);
  site.store.settings.set(site.tenant(), { ...saved, enabled: false, revision: 'disabled-elsewhere' });
  site.advance(100);
  assert.deepEqual((await site.search('refresh trigger')).content, [{ type: 'text', text: 'final refresh trigger' }]);
  await site.drainLoads();
  assert.equal(site.sender.attempts[0].signal?.aborted, true);
  site.sender.attempts[0].complete({ kind: 'accepted' });
  await site.drainLoads();
  assert.deepEqual((await site.search('after disabled')).content, [{ type: 'text', text: 'final after disabled' }]);
  await site.drainLoads();
  assert.equal(site.sender.attempts.length, 1);
  assert.match(JSON.stringify(site.sender.attempts[0]), /old active content/);
  assert.doesNotMatch(JSON.stringify(site.sender.attempts), /old queued content|refresh trigger|after disabled/);
  assert.equal(site.store.writes, 1);
});
