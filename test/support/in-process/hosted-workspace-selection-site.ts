import type { TestContext } from 'node:test';
import type { HostedPortal } from '../../../src/app/hosted-portal.ts';
import { hostedConfig } from '../fixtures/hosted-config.ts';
import { serveWorkOSSite } from './workos-site.ts';

export const workspaceSelectionUser = { id: 'user_WORKSPACE_PICKER', email: 'picker@example.com', firstName: 'Picker' };

export function serveWorkspaceSelectionSite(t: TestContext, config = hostedConfig, portal?: HostedPortal) {
  return serveWorkOSSite(t, {
    config,
    portal,
    organizations: ['org_ACME', 'org_GLOBEX'],
    setUp: world => {
      world.users = [workspaceSelectionUser];
      world.organizationNames = { org_ACME: 'Acme', org_GLOBEX: 'Globex' };
      world.memberships = [
        { userId: workspaceSelectionUser.id, organizationId: 'org_ACME', roles: ['user'], directoryManaged: false },
        { userId: workspaceSelectionUser.id, organizationId: 'org_GLOBEX', roles: ['admin'], directoryManaged: false },
      ];
    },
  });
}
