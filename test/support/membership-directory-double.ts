import {
  createRequestContext,
  type AccessDecision,
  type AccessResolver,
  type AuthenticatedUser,
  type RoleGrant,
} from '../../src/auth/access-context.ts';

export interface MembershipRecord {
  readonly subject: string;
  readonly organizationId: string;
  readonly active: boolean;
  readonly grants: readonly RoleGrant[];
}

// Test only: resolves hosted access from configured memberships, as a hosted provider reads the current membership
// for each request. The organization comes only from the verified user; the tenant comes from that organization.
export class MembershipDirectoryDouble implements AccessResolver {
  readonly calls: AuthenticatedUser[] = [];
  private readonly authority: string;
  private readonly memberships: readonly MembershipRecord[];
  private readonly held = new Map<string, Promise<void>>();

  constructor(authority: string, memberships: readonly MembershipRecord[]) {
    this.authority = authority;
    this.memberships = memberships;
  }

  // Delays each resolution of this membership until the returned function runs.
  hold(subject: string, organizationId: string): () => void {
    const release = Promise.withResolvers<void>();
    this.held.set(`${subject} ${organizationId}`, release.promise);
    return () => release.resolve();
  }

  async resolve(user: AuthenticatedUser): Promise<AccessDecision> {
    this.calls.push(user);
    const organizationId = user.selectedOrganizationId;
    if (user.authority !== this.authority) return { allowed: false, reason: 'account-inactive' };
    if (organizationId === undefined) return { allowed: false, reason: 'organization-required' };
    await this.held.get(`${user.subject} ${organizationId}`);
    const membership = this.memberships.find((record) => record.subject === user.subject && record.organizationId === organizationId);
    if (membership === undefined || !membership.active) return { allowed: false, reason: 'membership-inactive' };
    const context = createRequestContext({ user, tenantId: `hosted:${organizationId}`, organizationId, grants: membership.grants });
    return { allowed: true, context };
  }
}
