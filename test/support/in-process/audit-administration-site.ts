import type { TestContext } from 'node:test';
import { AuditLog, type AuditEvent } from '../../../src/logs/audit/audit-log.ts';
import { DestinationSettingsService } from '../../../src/logs/audit/destination-settings-service.ts';
import { DestinationSettingsFake } from '../doubles/logging/destination-settings-fake.ts';
import { signInThroughServer } from '../dsl/workos-sign-in.ts';
import { serveWorkOSSite } from './workos-site.ts';

const organizationId = 'org_CAPTURE_A';
export const auditAdministrationAdmin = { id: 'user_CAPTURE_ADMIN', email: 'capture-admin@example.com', firstName: 'Admin' };

export async function serveAuditAdministrationSite(t: TestContext, write: (event: AuditEvent) => void) {
  const store = new DestinationSettingsFake();
  const sent: AuditEvent[] = [];
  const service = new DestinationSettingsService(store, Buffer.alloc(32, 7), { send: async (_destination, event) => { sent.push(event); return { kind: 'accepted' }; } });
  const site = await serveWorkOSSite(t, {
    organizations: [organizationId], audit: new AuditLog({ writeAuditEvent: write }),
    loggingStorage: { store, service, close: async () => {} },
    setUp: world => { world.users = [auditAdministrationAdmin]; world.memberships = [{ userId: auditAdministrationAdmin.id, organizationId, roles: ['admin'] }]; },
  });
  const { browser } = await signInThroughServer(site, auditAdministrationAdmin, organizationId);
  return { site, browser, store, sent, tenantId: `workos:${site.world.settings.clientId}:${organizationId}` };
}
