import { AuditLog, type AuditEvent } from '../../../src/logs/audit/audit-log.ts';
import { AuditSnapshots } from '../../../src/logs/audit/audit-snapshots.ts';
import { AuditCollector } from '../../../src/logs/audit/audit-collector.ts';
import { DestinationSettingsService } from '../../../src/logs/audit/destination-settings-service.ts';
import type { DestinationTestSender } from '../../../src/logs/audit/destination-test.ts';
import type { AuditDestination } from '../../../src/logs/audit/audit-send.ts';
import { DestinationSettingsFake } from '../doubles/logging/destination-settings-fake.ts';

const senderStub: DestinationTestSender = { send: async () => { throw new Error('Save and export authorization must not send a Test.'); } };

export function composeAuditCollectorSite() {
  const store = new DestinationSettingsFake();
  const service = new DestinationSettingsService(store, Buffer.alloc(32, 7), senderStub);
  const sent: { destination: AuditDestination; event: AuditEvent }[] = [];
  const collector = new AuditCollector(service, { start: (destination, event) => {
    sent.push({ destination, event });
    return { outcome: Promise.resolve({ kind: 'accepted' as const }), settled: Promise.resolve() };
  } });
  const snapshots = new AuditSnapshots(store, collector);
  const audit = new AuditLog(snapshots);
  let operation = 0;
  return {
    store, service, sent,
    close: () => { snapshots.close(); collector.close(); },
    settle: () => new Promise<void>(resolve => setImmediate(resolve)),
    activity: (organizationId: string, text: string) => audit.toolCompleted({
      timestamp: '2026-10-24T12:00:00.000Z', organizationId, actor: { authority: 'trusted-provider', subject: 'admin' },
      operationId: `operation-${++operation}`, tool: 'search', input: { query: text, reason: 'collector acceptance' }, result: text, status: 'success', durationMs: 1,
    }),
    save: async (tenant: string, endpoint = 'https://collector.example/v1/logs') => {
      const current = await service.read(tenant);
      return service.save(tenant, { expectedRevision: current.status === 'found' ? current.settings.revision : null, endpoint, auth: 'none', enabled: true, token: '' });
    },
  };
}
