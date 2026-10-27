import type { Billing } from '../billing/billing.ts';
import type { SeatUsage } from './administration-overviews.ts';
import { latestOfEach, readDirectoryPages } from './directory-reads.ts';
import type { InvitationState, OrganizationDirectory, OrganizationMemberFacts } from './organization-directory.ts';

// The member limit of a plan. Each active membership with product access holds a seat, and each pending invitation
// reserves one: the directory owns the acceptance, so the application can refuse an invitation only when it is sent.
export class MemberLimit {
  private readonly directory: OrganizationDirectory;
  private readonly billing: Billing;
  // The end of the last send of each organization that is queued or running.
  private readonly sends = new Map<string, Promise<void>>();

  constructor(directory: OrganizationDirectory, billing: Billing) {
    this.directory = directory;
    this.billing = billing;
  }

  // The seats from the current plan and complete member reads, or undefined for a plan without a member limit. The
  // invitations must come from a complete read. A failed read fails the count, so that no partial count looks complete.
  async usageOf(organizationId: string, invitations: readonly { readonly state: InvitationState }[]): Promise<SeatUsage | undefined> {
    const state = await this.billing.stateOf(organizationId);
    if (state.plan !== 'free') return undefined;
    const members = await activeMemberFacts(this.directory, organizationId);
    const reserved = invitations.filter((invitation) => invitation.state === 'pending').length;
    return Object.freeze({ used: members.filter(holdsSeat).length + reserved, limit: state.memberLimit });
  }

  // Runs each send of an organization after the earlier sends of that organization end, so that each count includes
  // the invitations of the earlier sends. Sends of other organizations do not wait. The queue lives in this process,
  // because the hosted control plane runs one instance.
  async serialize<T>(organizationId: string, send: () => Promise<T>): Promise<T> {
    const earlier = this.sends.get(organizationId) ?? Promise.resolve();
    const done = Promise.withResolvers<void>();
    const end = earlier.then(() => done.promise);
    this.sends.set(organizationId, end);
    try {
      await earlier;
      return await send();
    } finally {
      done.resolve();
      if (this.sends.get(organizationId) === end) this.sends.delete(organizationId);
    }
  }
}

// An invitation beyond the limit would give more members than the plan allows.
export function limitReached(usage: SeatUsage | undefined): boolean {
  return usage !== undefined && usage.used >= usage.limit;
}

// Each active membership with product access holds one seat, an Admin-only membership included. A default role gives
// no product access, so it holds none.
export function holdsSeat(member: Pick<OrganizationMemberFacts, 'status' | 'grants'>): boolean {
  return member.status === 'active' && member.grants.some((grant) => grant.permissions.includes('product:access'));
}

// The safety facts need no display read of each user. Each page must succeed.
async function activeMemberFacts(directory: OrganizationDirectory, organizationId: string): Promise<readonly OrganizationMemberFacts[]> {
  const records = await readDirectoryPages((cursor) => directory.memberFactsPage({ organizationId, statuses: ['active'], cursor }));
  return latestOfEach(records, ({ membershipId }) => membershipId).filter((member) => member.organizationId === organizationId);
}
