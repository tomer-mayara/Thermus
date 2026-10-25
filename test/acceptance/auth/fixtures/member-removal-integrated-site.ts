import type { TestContext } from 'node:test';
import { composeLoggingStorage } from '../../../../src/app/logging-storage.ts';
import type { ToolOperations } from '../../../../src/app/fetch-tool.ts';
import { createPgSettingsRuntime } from '../../../../src/logs/audit/bounded-sql-runtime.ts';
import { PgDestinationSettingsStore } from '../../../../src/logs/audit/pg-destination-settings-store.ts';
import type { TrackedAuditSender } from '../../../../src/logs/audit/audit-send.ts';
import type { DestinationTestSender } from '../../../../src/logs/audit/destination-test.ts';
import { postgresSettingsSite } from '../../../support/in-process/postgres-settings-site.ts';
import { serveWorkOSSite } from '../../../support/in-process/workos-site.ts';

export const organization = 'org_INTEGRATED_REMOVAL';
export const otherOrganization = 'org_INTEGRATED_OTHER';
export const removingAdmin = { id: 'user_integrated_admin', email: 'integrated-admin@example.com', firstName: 'Removing Admin' };
export const remainingAdmin = { id: 'user_integrated_remaining', email: 'integrated-remaining@example.com', firstName: 'Remaining Admin' };
export const ordinaryUser = { id: 'user_integrated_user', email: 'integrated-user@example.com', firstName: 'Ordinary User' };

export async function serveIntegratedRemovalSite(t: TestContext, options: {
  readonly reauthentication?: boolean;
  readonly sender?: DestinationTestSender & TrackedAuditSender;
  readonly toolOperations?: ToolOperations;
} = {}) {
  const sql = await postgresSettingsSite(t);
  const runtime = createPgSettingsRuntime({ ...sql.connection, bounds: { operationMs: 1_000, statementMs: 1_000 } });
  t.after(() => runtime.close());
  const store = new PgDestinationSettingsStore(runtime);
  const storage = composeLoggingStorage({ store, removalStore: store, close: () => runtime.close() }, Buffer.alloc(32, 7), options.sender);
  t.after(() => storage.close());
  const site = await serveWorkOSSite(t, {
    organizations: [organization, otherOrganization],
    loggingStorage: storage,
    toolOperations: options.toolOperations,
    setUp: world => {
      if (options.reauthentication) world.expireAccessTokens();
      world.users = [removingAdmin, remainingAdmin, ordinaryUser];
      world.organizationNames = { [organization]: 'Removal Labs', [otherOrganization]: 'Other Labs' };
      world.memberships = [
        { userId: removingAdmin.id, organizationId: organization, roles: ['admin'], directoryManaged: false },
        { userId: remainingAdmin.id, organizationId: organization, roles: ['admin'], directoryManaged: false },
        { userId: ordinaryUser.id, organizationId: organization, roles: ['user'], directoryManaged: false },
        { userId: removingAdmin.id, organizationId: otherOrganization, roles: ['user'], directoryManaged: false },
        { userId: ordinaryUser.id, organizationId: otherOrganization, roles: ['user'], directoryManaged: false },
      ];
      for (const user of [removingAdmin, ordinaryUser]) {
        const factor = { object: 'authentication_factor', id: `auth_factor_${user.id}`, type: 'totp', totp: { issuer: 'Thermus', user: user.email }, created_at: '2026-10-01T08:00:00.000Z', updated_at: '2026-10-01T08:00:00.000Z' };
        world.fake.answer(`GET /user_management/users/${user.id}/auth_factors`, { status: 200, body: { object: 'list', data: [factor], list_metadata: { before: null, after: null } } });
      }
    },
  });
  const { workos } = site.world.connection();
  return { ...site, sql, runtime, store, storage, tenant: `workos:${site.world.settings.clientId}:${organization}`, readPreservedScope: async () => Promise.all([removingAdmin, ordinaryUser].map(async user => ({
    account: await workos.userManagement.getUser(user.id),
    membership: await workos.userManagement.getOrganizationMembership(site.world.membershipId(user, otherOrganization)),
    factors: (await workos.multiFactorAuth.listUserAuthFactors({ userId: user.id })).data,
  }))) };
}
