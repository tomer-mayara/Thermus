import { createHash } from 'node:crypto';
import { workosAuthority } from '../../../src/accounts/providers/workos/workos-settings.ts';
import type { FixtureFactory, LiveUser } from './staging-fixtures.ts';

export function personalExternalId(clientId: string, subject: string): string {
  return `thermus-signup:${createHash('sha256').update(workosAuthority(clientId)).update('\0').update(subject).digest('base64url')}`;
}

// A verified new user without memberships, from the fixture factory of the run. Each signup suite of a run gives its
// own label, so each gets its own user.
export async function createSignupFixtures(make: FixtureFactory, label = 'signup'): Promise<{ user: LiveUser }> {
  const user = await make.user(label);
  return { user };
}
