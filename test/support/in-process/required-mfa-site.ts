import type { TestContext } from 'node:test';
import type { FakeUser } from '../doubles/workos/workos-fake.ts';
import { hostedRootConfig } from '../fixtures/hosted-config.ts';
import { serveWorkOSSite } from './workos-site.ts';

export function serveRequiredMfaSite(t: TestContext, user: FakeUser, organizations: readonly string[]) {
  return serveWorkOSSite(t, {
    config: hostedRootConfig,
    organizations,
    setUp: (world) => {
      const connection = world.connection();
      world.connection = () => ({ ...connection, settings: { ...connection.settings, mfaPolicy: 'required' } });
      world.users = [user];
      world.memberships = organizations.map((organizationId) => ({ userId: user.id, organizationId, roles: ['admin'] }));
    },
  });
}
