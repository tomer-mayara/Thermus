import type { TestContext } from 'node:test';
import { DestinationSettingsFake } from '../doubles/logging/destination-settings-fake.ts';
import { RemovalOperationStoreFake } from '../doubles/organizations/removal-operation-store-fake.ts';
import { serveWorkOSSite } from './workos-site.ts';
import type { WorkOSFake } from '../doubles/workos/workos-fake.ts';
import { signupDocuments } from '../fixtures/signup-documents.ts';
import type { AuditLog } from '../../../src/logs/audit/audit-log.ts';
import type { HostedPortal } from '../../../src/app/hosted-portal.ts';

export const removalOrganization = 'org_REMOVAL';
export const otherOrganization = 'org_OTHER';
export const removalAdmin = { id: 'user_ADMIN', email: 'admin@example.com', firstName: 'Admin' };
export const remainingAdmin = { id: 'user_ADMIN2', email: 'admin2@example.com', firstName: 'Second Admin' };
export const removalUser = { id: 'user_USER', email: 'user@example.com', firstName: 'User' };

export async function serveMemberRemovalSite(t: TestContext, options: { readonly setUp?: (world: WorkOSFake) => void; readonly audit?: AuditLog; readonly portal?: HostedPortal } = {}) {
  const removalStore = new RemovalOperationStoreFake();
  const site = await serveWorkOSSite(t, {
    organizations: [removalOrganization, otherOrganization],
    signupFake: true,
    signup: { enabled: true, documents: signupDocuments },
    audit: options.audit,
    portal: options.portal,
    loggingStorage: { store: new DestinationSettingsFake(), removalStore, close: async () => {} },
    setUp: world => {
      world.users = [removalAdmin, remainingAdmin, removalUser];
      world.organizationNames = { [removalOrganization]: 'Acme', [otherOrganization]: 'Globex' };
      world.memberships = [
        { userId: removalAdmin.id, organizationId: removalOrganization, roles: ['admin'], directoryManaged: false },
        { userId: remainingAdmin.id, organizationId: removalOrganization, roles: ['admin'], directoryManaged: false },
        { userId: removalUser.id, organizationId: removalOrganization, roles: ['user'], directoryManaged: false },
        { userId: removalUser.id, organizationId: otherOrganization, roles: ['user'], directoryManaged: false },
      ];
      options.setUp?.(world);
    },
  });
  return { ...site, removalStore };
}
