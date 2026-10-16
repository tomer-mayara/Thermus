import { createHash } from 'node:crypto';
import type { WorkOS } from '@workos-inc/node';
import { workosAuthority } from '../../../src/auth/hosted-auth/workos/workos-settings.ts';
import type { FixtureRegistry } from './fixture-registry.ts';
import { FixtureFactory, type LiveUser } from './staging-fixtures.ts';

export function personalExternalId(clientId: string, subject: string): string {
  return `thermus-signup:${createHash('sha256').update(workosAuthority(clientId)).update('\0').update(subject).digest('base64url')}`;
}

export async function createSignupFixtures(workos: WorkOS, registry: FixtureRegistry, runId: string): Promise<{ user: LiveUser }> {
  const make = new FixtureFactory(workos, registry, runId);
  const user = await make.user('signup');
  return { user };
}
