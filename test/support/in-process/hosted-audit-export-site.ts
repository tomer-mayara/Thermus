import type { TestContext } from 'node:test';
import { composeLoggingStorage } from '../../../src/app/logging-storage.ts';
import { AuditExportSenderSpy } from '../doubles/logging/audit-export-sender-spy.ts';
import { SnapshotSettingsStoreSpy } from '../doubles/logging/snapshot-settings-store-spy.ts';
import { serveHostedAuditSnapshotSite, snapshotOrganizations } from './hosted-audit-snapshot-site.ts';

export async function serveHostedAuditExportSite(t: TestContext) {
  const store = new SnapshotSettingsStoreSpy();
  const sender = new AuditExportSenderSpy();
  const storage = composeLoggingStorage({ store, close: async () => { store.close(); } }, Buffer.alloc(32, 7), sender);
  const capture = await serveHostedAuditSnapshotSite(t, store, { loggingStorage: storage, auditSink: null });
  t.after(() => sender.attempts.forEach(attempt => attempt.complete()));
  return {
    ...capture, sender, storage,
    enable: async (index = 0, endpoint = 'https://collector.example/v1/logs') => {
      const tenant = capture.tenant(snapshotOrganizations[index]);
      const current = store.settings.get(tenant);
      return storage.service.save(tenant, { expectedRevision: current?.revision ?? null, endpoint, auth: 'none', token: '', enabled: true });
    },
  };
}
