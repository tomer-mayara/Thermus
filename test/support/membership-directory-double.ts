import {
  createRequestContext,
  type AccessDecision,
  type AccessResolver,
  type AuthenticatedUser,
} from '../../src/auth/access-context.ts';
import type { MemberSeed } from './doubles/organizations/directory-double-records.ts';
import { OrganizationDirectoryDouble } from './doubles/organizations/organization-directory-double.ts';

export interface MembershipRecord extends MemberSeed {
  readonly organizationName: string;
  readonly active: boolean;
}

// Reads the configured memberships for access resolution and for the organization work, as the hosted provider will
// read the same provider state for both. A grant change takes effect in the next access resolution.
export class MembershipDirectoryDouble extends OrganizationDirectoryDouble implements AccessResolver {
  readonly calls: AuthenticatedUser[] = [];
  private readonly paused = new Map<string, Promise<void>>();

  constructor(authority: string, memberships: readonly MembershipRecord[]) {
    super();
    this.authority = authority;
    this.replaceMemberships(memberships);
  }

  pauseResolution(subject: string, organizationId: string): () => void {
    const resume = Promise.withResolvers<void>();
    this.paused.set(`${subject} ${organizationId}`, resume.promise);
    return () => resume.resolve();
  }

  replaceMemberships(memberships: readonly MembershipRecord[]): void {
    this.replaceMembers(memberships.map((record) => ({ ...record, status: record.status ?? (record.active ? 'active' : 'inactive') })));
  }

  async resolve(user: AuthenticatedUser): Promise<AccessDecision> {
    this.calls.push(user);
    const organizationId = user.selectedOrganizationId;
    if (user.authority !== this.authority) return { allowed: false, reason: 'account-inactive' };
    if (organizationId === undefined) return { allowed: false, reason: 'organization-required' };
    await this.paused.get(`${user.subject} ${organizationId}`);
    const membership = this.membershipIn(user.subject, organizationId);
    if (membership === undefined || membership.status !== 'active') return { allowed: false, reason: 'membership-inactive' };
    const context = createRequestContext({ user, tenantId: `hosted:${organizationId}`, organizationId, grants: membership.grants });
    return { allowed: true, context };
  }
}
