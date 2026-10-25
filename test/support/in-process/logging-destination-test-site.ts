import type { TestContext } from 'node:test';
import { DestinationSettingsService } from '../../../src/logs/audit/destination-settings-service.ts';
import type { AuditDestination, AuditSendOutcome } from '../../../src/logs/audit/audit-send.ts';
import type { AuditEvent } from '../../../src/logs/audit/audit-log.ts';
import { DestinationSettingsFake } from '../doubles/logging/destination-settings-fake.ts';
import { hostedConfig } from '../fixtures/hosted-config.ts';
import { serveWorkOSSite } from './workos-site.ts';

export const destinationTestOrganizationId = 'org_LOGGING_TEST';
export const destinationTestAdmin = { id: 'user_LOGGING_TEST', email: 'test-admin@example.com', firstName: 'Admin' };

export const destinationTestEndpoint = 'https://collector.example/v1/logs';
export const destinationTestSecret = 'acceptance-only-private-test-token';

export async function serveDestinationTestSite(t: TestContext, options: { config?: typeof hostedConfig; auth?: 'none' | 'bearer'; send?: () => Promise<AuditSendOutcome> } = {}) {
  const { config = hostedConfig, auth = 'bearer', send } = options;
  const store = new DestinationSettingsFake();
  const calls: { destination: AuditDestination; event: AuditEvent }[] = [];
  const service = new DestinationSettingsService(store, Buffer.alloc(32, 7), {
    send: async (destination, event) => { calls.push({ destination, event }); return send ? send() : { kind: 'accepted' }; },
  });
  const site = await serveWorkOSSite(t, {
    config, organizations: [destinationTestOrganizationId], loggingStorage: { store, service, close: async () => {} },
    setUp: (world) => {
      world.users = [destinationTestAdmin];
      world.memberships = [{ userId: destinationTestAdmin.id, organizationId: destinationTestOrganizationId, roles: ['admin'] }];
    },
  });
  const tenantId = `workos:${site.world.settings.clientId}:${destinationTestOrganizationId}`;
  await service.save(tenantId, { expectedRevision: null, endpoint: destinationTestEndpoint, auth, token: auth === 'bearer' ? destinationTestSecret : '', enabled: false });
  return { site, store, service, tenantId, calls };
}
