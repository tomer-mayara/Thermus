import type { AuthenticatedUser } from '../../../../src/auth/access-context.ts';
import type { OrganizationDirectory, OrganizationMembership } from '../../../../src/organizations/organization-administration.ts';

export type ConfiguredMemberships = readonly OrganizationMembership[] | Error;

// Gives the configured memberships of each user subject, or fails with a configured error. A user without a
// configuration has no membership. A test can change a configuration between calls, as the provider state changes.
export class OrganizationDirectoryDouble implements OrganizationDirectory {
  readonly calls: AuthenticatedUser[] = [];
  private readonly memberships: Map<string, ConfiguredMemberships>;

  constructor(memberships: ReadonlyMap<string, ConfiguredMemberships> = new Map()) {
    this.memberships = new Map(memberships);
  }

  configure(subject: string, memberships: ConfiguredMemberships): void {
    this.memberships.set(subject, memberships);
  }

  async membershipsOf(user: AuthenticatedUser): Promise<readonly OrganizationMembership[]> {
    this.calls.push(user);
    const configured = this.memberships.get(user.subject) ?? [];
    if (configured instanceof Error) throw configured;
    return configured;
  }
}
