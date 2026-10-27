import type { TestContext } from 'node:test';
import { hostedConfig } from '../fixtures/hosted-config.ts';
import { serveWorkOSSite } from './workos-site.ts';

export const workspaceSelectionUser = { id: 'user_WORKSPACE_PICKER', email: 'picker@example.com', firstName: 'Picker' };

export function serveWorkspaceSelectionSite(t: TestContext, config = hostedConfig) {
  return serveWorkOSSite(t, {
    config,
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
