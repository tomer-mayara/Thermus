import type { ListOrganizationMembershipsOptions, OrganizationMembershipStatus } from '@workos-inc/node';
import type { AuthenticatedUser, RoleGrant } from '../../access-context.ts';
import type {
  DirectoryChangeResult,
  DirectoryGrantChange,
  InvitationPageRequest,
  InvitationRequest,
  InvitationSendResult,
  InvitationUpdateResult,
  MemberPageRequest,
  OrganizationDirectory,
  OrganizationInvitation,
  OrganizationMember,
  OrganizationMembership,
  Page,
} from '../../../organizations/organization-directory.ts';
import { grantsOfRoles, HostedRoleConfigurationError, type RoleRecord } from './hosted-role-mapping.ts';

interface MembershipRecord {
  readonly userId: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly status: OrganizationMembershipStatus;
  readonly roles?: readonly { readonly slug: string }[];
}

interface MembershipPage {
  readonly data: readonly MembershipRecord[];
  readonly listMetadata: { readonly after?: string | null };
}

// The reads of the pinned SDK client that access resolution and the organization reads need. The client fits this shape.
export interface WorkOSOrganizationsOptions {
  // The one authority of the WorkOS environment, from workosAuthority(). Only its users have WorkOS memberships.
  readonly authority: string;
  readonly userManagement: {
    listOrganizationMemberships(options: ListOrganizationMembershipsOptions): Promise<MembershipPage>;
  };
  readonly authorization: {
    listOrganizationRoles(organizationId: string): Promise<{ readonly data: readonly RoleRecord[] }>;
  };
}

// A user has at most one membership in an organization. The limit only bounds the read.
const MEMBERSHIP_READ_LIMIT = 10;
// The largest page that WorkOS gives. The page limit bounds the read of the memberships of one user.
const MEMBERSHIP_PAGE_SIZE = 100;
const MEMBERSHIP_PAGE_LIMIT = 10;
const NO_MEMBERSHIPS: readonly OrganizationMembership[] = Object.freeze([]);
const UNSUPPORTED = Object.freeze({ outcome: 'unsupported' as const });

// The organization directory of the hosted edition. Each read asks WorkOS again, so that a revoked membership or role
// stops access at the next request. A failed or unexpected read throws, so that access fails closed and a failure
// never looks like a missing membership.
export class WorkOSOrganizations implements OrganizationDirectory {
  // WorkOS can accept an invitation for another address of the same domain, so the directory claims no strict match.
  readonly invitationIdentityPolicy = 'provider-rules';
  private readonly authority: string;
  private readonly userManagement: WorkOSOrganizationsOptions['userManagement'];
  private readonly authorization: WorkOSOrganizationsOptions['authorization'];

  constructor(options: WorkOSOrganizationsOptions) {
    this.authority = options.authority;
    this.userManagement = options.userManagement;
    this.authorization = options.authorization;
  }

  // The current grants of one user in one organization, for access resolution. No active membership gives undefined.
  async activeGrants(userId: string, organizationId: string): Promise<readonly RoleGrant[] | undefined> {
    const membership = await this.activeMembership(userId, organizationId);
    return membership === undefined ? undefined : this.grantsOf(membership);
  }

  // Each active membership of the user, from every page, with every current grant. The read names the status active,
  // so that no default filter of WorkOS decides. A user of another authority has no WorkOS membership, so its subject
  // is never sent to WorkOS.
  async membershipsOf(user: AuthenticatedUser): Promise<readonly OrganizationMembership[]> {
    if (user.authority !== this.authority) return NO_MEMBERSHIPS;
    const memberships: OrganizationMembership[] = [];
    for (const record of await this.activeMembershipsOf(user.subject)) {
      const { organizationId, organizationName } = record;
      memberships.push(Object.freeze({ organizationId, organizationName, active: true, grants: await this.grantsOf(record) }));
    }
    return Object.freeze(memberships);
  }

  // AUTH-08W reads the members and invitations from WorkOS and makes the changes. Until then each read fails, so that
  // no empty page looks like an organization without members or invitations, and each change changes nothing.
  async memberPage(_request: MemberPageRequest): Promise<Page<OrganizationMember>> {
    throw notReadYet('the members of an organization');
  }

  async member(_membershipId: string): Promise<OrganizationMember | undefined> {
    throw notReadYet('a member');
  }

  async invitationPage(_request: InvitationPageRequest): Promise<Page<OrganizationInvitation>> {
    throw notReadYet('the invitations of an organization');
  }

  async invitation(_invitationId: string): Promise<OrganizationInvitation | undefined> {
    throw notReadYet('an invitation');
  }

  async changeGrant(_change: DirectoryGrantChange): Promise<DirectoryChangeResult> {
    return UNSUPPORTED;
  }

  async sendInvitation(_request: InvitationRequest): Promise<InvitationSendResult> {
    return UNSUPPORTED;
  }

  async resendInvitation(_invitationId: string): Promise<InvitationUpdateResult> {
    return UNSUPPORTED;
  }

  async revokeInvitation(_invitationId: string): Promise<InvitationUpdateResult> {
    return UNSUPPORTED;
  }

  private async activeMembership(userId: string, organizationId: string): Promise<MembershipRecord | undefined> {
    const page = await this.userManagement.listOrganizationMemberships({ userId, organizationId, statuses: ['active'], limit: MEMBERSHIP_READ_LIMIT });
    if (page.data.length > 1 || Boolean(page.listMetadata.after)) {
      throw new Error('WorkOS answered more than one active membership, or a next page, for one user in one organization');
    }
    const [membership] = page.data;
    if (membership === undefined) return undefined;
    if (membership.userId !== userId || membership.organizationId !== organizationId || membership.status !== 'active') {
      throw new Error('WorkOS answered a membership that the read did not ask for');
    }
    return membership;
  }

  // Reads each page in order. A read that does not end fails, with a repeated cursor or after the page limit, so that
  // no partial list looks complete.
  private async activeMembershipsOf(userId: string): Promise<readonly MembershipRecord[]> {
    const records: MembershipRecord[] = [];
    const cursors = new Set<string>();
    let after: string | undefined;
    for (let pages = 0; pages < MEMBERSHIP_PAGE_LIMIT; pages += 1) {
      const page = await this.userManagement.listOrganizationMemberships({ userId, statuses: ['active'], limit: MEMBERSHIP_PAGE_SIZE, ...(after === undefined ? {} : { after }) });
      records.push(...page.data.map((record) => checkedActiveRecord(record, userId)));
      const next = page.listMetadata.after;
      if (!next) return eachOrganizationOnce(records);
      if (cursors.has(next)) throw new Error('WorkOS repeated a page cursor of the memberships of one user');
      cursors.add(next);
      after = next;
    }
    throw new Error(`WorkOS gave more than ${MEMBERSHIP_PAGE_LIMIT} pages of memberships for one user`);
  }

  private async grantsOf(membership: MembershipRecord): Promise<readonly RoleGrant[]> {
    const { organizationId, roles: membershipRoles } = membership;
    if (membershipRoles === undefined) {
      throw new HostedRoleConfigurationError(`A membership in the organization ${organizationId} has no role list. `
        + 'The WorkOS environment must allow multiple roles for each membership.');
    }
    const { data: roles } = await this.authorization.listOrganizationRoles(organizationId);
    return grantsOfRoles(membershipRoles, roles, organizationId);
  }
}

function notReadYet(records: string): Error {
  return new Error(`The organization directory does not read ${records} from WorkOS yet`);
}

function checkedActiveRecord(record: MembershipRecord, userId: string): MembershipRecord {
  if (record.userId !== userId || record.status !== 'active') throw new Error('WorkOS answered a membership that the read did not ask for');
  if (typeof record.organizationName !== 'string' || record.organizationName === '') {
    throw new Error(`WorkOS answered the membership in the organization ${record.organizationId} without an organization name`);
  }
  return record;
}

function eachOrganizationOnce(records: readonly MembershipRecord[]): readonly MembershipRecord[] {
  const organizations = new Set(records.map(({ organizationId }) => organizationId));
  if (organizations.size !== records.length) throw new Error('WorkOS answered more than one active membership for one user in one organization');
  return records;
}
