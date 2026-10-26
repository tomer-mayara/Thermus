import assert from 'node:assert/strict';
import test from 'node:test';
import { PgDestinationSettingsStore } from '../../../src/logs/audit/pg-destination-settings-store.ts';
import { createPgSettingsRuntime } from '../../../src/logs/audit/bounded-sql-runtime.ts';
import { postgresSettingsSite } from '../../support/in-process/postgres-settings-site.ts';
import { MembershipRemovalProcess, type RemovalCrashStage } from '../../support/processes/membership-removal-process.ts';

for (const stage of ['after-admission', 'during-provider', 'before-completion'] satisfies RemovalCrashStage[]) {
  test(`Given a removal process paused ${stage}, when it is killed and a fresh process checks unchanged provider state, then the same durable hold refuses a conflicting removal`, { timeout: 60_000 }, async t => {
    const site = await postgresSettingsSite(t);
    const observerRuntime = createPgSettingsRuntime(site.connection);
    t.after(() => observerRuntime.close());
    const observer = new PgDestinationSettingsStore(observerRuntime);
    const first = MembershipRemovalProcess.launch(t, site.connection, stage);
    assert.notEqual(first.pid, process.pid);
    const paused = await first.message('paused');
    assert.equal(paused.stage, stage);
    assert.equal(paused.deleteCalls, stage === 'after-admission' ? 0 : 1);
    if (stage === 'before-completion') assert.equal(paused.completionOutcome, 'applied');
    const pending = await observer.readRemoval('org-a');
    assert.equal(pending.status, 'found');
    if (pending.status !== 'found') throw new Error('Expected committed pending removal');
    assert.equal(pending.operation.operationId, paused.operationId);
    assert.equal(pending.operation.membershipId, 'admin-b-in-a');
    assert.equal(pending.operation.outcome, null);
    assert.equal(await site.settingsConnections(true), 0, 'The paused owner must retain no active SQL operation');
    assert.equal(await first.crash(), 'SIGKILL');
    const restarted = MembershipRemovalProcess.launch(t, site.connection, 'restart');
    assert.notEqual(restarted.pid, first.pid);
    const result = await restarted.message('result');
    assert.equal(result.result, 'busy');
    assert.equal(result.deleteCalls, 0);
    assert.ok((result.membershipReads ?? 0) > 0, 'The restarted Admin is checked against current provider memberships');
    assert.ok((result.memberPageReads ?? 0) > 0, 'A current Members refresh runs against unchanged provider facts before the conflicting request');
    await restarted.finished();
    assert.deepEqual(await observer.readRemoval('org-a'), pending, 'Restart and unchanged reads must preserve the same operation and pending outcome');
  });
}
