import {
  createRequestContext,
  type AccessDecision,
  type AccessResolver,
  type AuthenticatedUser,
  type RoleGrant,
} from '../../src/auth/access-context.ts';
import type { OrganizationDirectory, OrganizationMembership } from '../../src/organizations/organization-administration.ts';

export interface MembershipRecord {
  readonly subject: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly active: boolean;
  readonly grants: readonly RoleGrant[];
}

// Reads the configured memberships for access resolution and for the organization reads, as the hosted provider will
// read the same provider state for both.
export class MembershipDirectoryDouble implements AccessResolver, OrganizationDirectory {
  readonly calls: AuthenticatedUser[] = [];
  readonly membershipReads: AuthenticatedUser[] = [];
  private readonly authority: string;
  private memberships: readonly MembershipRecord[];
  private readonly paused = new Map<string, Promise<void>>();
  private readOutage?: Error;

  constructor(authority: string, memberships: readonly MembershipRecord[]) {
    this.authority = authority;
    this.memberships = memberships;
  }

  pauseResolution(subject: string, organizationId: string): () => void {
    const resume = Promise.withResolvers<void>();
    this.paused.set(`${subject} ${organizationId}`, resume.promise);
    return () => resume.resolve();
  }

  // The next reads see the change, as after an invitation, a grant change, or a deactivation in the provider.
  replaceMemberships(memberships: readonly MembershipRecord[]): void {
    this.memberships = memberships;
  }

  // While an outage lasts, each organization read fails; access resolution still works.
  failMembershipReads(outage: Error | undefined): void {
    this.readOutage = outage;
  }

  async resolve(user: AuthenticatedUser): Promise<AccessDecision> {
    this.calls.push(user);
    const organizationId = user.selectedOrganizationId;
    if (user.authority !== this.authority) return { allowed: false, reason: 'account-inactive' };
    if (organizationId === undefined) return { allowed: false, reason: 'organization-required' };
    await this.paused.get(`${user.subject} ${organizationId}`);
    const membership = this.memberships.find((record) => record.subject === user.subject && record.organizationId === organizationId);
    if (membership === undefined || !membership.active) return { allowed: false, reason: 'membership-inactive' };
    const context = createRequestContext({ user, tenantId: `hosted:${organizationId}`, organizationId, grants: membership.grants });
    return { allowed: true, context };
  }

  async membershipsOf(user: AuthenticatedUser): Promise<readonly OrganizationMembership[]> {
    this.membershipReads.push(user);
    if (this.readOutage !== undefined) throw this.readOutage;
    if (user.authority !== this.authority) return [];
    return this.memberships
      .filter((record) => record.subject === user.subject)
      .map(({ organizationId, organizationName, active, grants }) => ({ organizationId, organizationName, active, grants }));
  }
}
