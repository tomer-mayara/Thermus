import { AuditLog } from '../../../src/logs/audit/audit-log.ts';
import { AuditSnapshots, type RevisionBoundAuditEvent } from '../../../src/logs/audit/audit-snapshots.ts';
import { DestinationSettingsFake } from '../doubles/logging/destination-settings-fake.ts';

export function composeAuditSnapshotSite() {
  const store = new DestinationSettingsFake();
  const admitted: RevisionBoundAuditEvent[] = [];
  let now = 0;
  const snapshots = new AuditSnapshots(store, { admit: item => { admitted.push(item); } }, { now: () => now });
  const audit = new AuditLog(snapshots);
  return {
    store, admitted, close: () => snapshots.close(),
    advance: (milliseconds: number) => { now += milliseconds; },
    activity: (organizationId: string, text: string) => audit.toolCompleted({
      timestamp: '2026-10-24T12:00:00.000Z', organizationId, actor: { authority: 'trusted-provider', subject: 'admin' },
      operationId: text, tool: 'search', input: { query: text, reason: 'snapshot acceptance' }, result: text, status: 'success', durationMs: 1,
    }),
    save: async (organizationId: string, enabled: boolean) => {
      const current = await store.read(organizationId);
      return store.save(organizationId, current.status === 'found' ? current.settings.revision : null, {
        endpoint: 'https://private-collector.example/v1/logs', auth: 'none', encryptedCredential: null, enabled,
      });
    },
    // This site uses immediate in-memory reads. One immediate turn completes those loads.
    loadsSettled: () => new Promise<void>(resolve => setImmediate(resolve)),
  };
}
