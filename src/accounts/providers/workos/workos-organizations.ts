import { createHash } from 'node:crypto';
import type { AuthenticatedUser, RoleGrant } from '../../identity/access-context.ts';
import type {
  InvitationPageRequest,
  InvitationRequest,
  InvitationSendResult,
  InvitationUpdateResult,
  MemberPageRequest,
  MembershipManagement,
  MembershipDeletionResult,
  OrganizationDirectory,
  OrganizationInvitation,
  OrganizationMember,
  OrganizationMemberFacts,
  OrganizationMembership,
  Page,
} from '../../organizations/organization-directory.ts';
import { grantsOfRoles, HostedRoleConfigurationError, type RoleRecord } from './hosted-role-mapping.ts';
import { afterOf, hasCode, hasStatus, PAGE_SIZE, pageOf, unlessNotFound } from './workos-answers.ts';
import { WorkOSInvitations, type InvitationCalls } from './workos-invitations.ts';
import type { MembershipReads, MembershipRecord } from './workos-membership-reads.ts';

// The calls of the pinned SDK client that access resolution and organization administration need. The client fits this
// shape. Membership deletion names one exact ID. There is no user, factor, role, creation, or status writer.
export interface WorkOSOrganizationsOptions {
  readonly authority: string;
  readonly memberships: MembershipReads;
  readonly userManagement: InvitationCalls & {
    deleteOrganizationMembership(organizationMembershipId: string): Promise<void>;
    getUser(userId: string): Promise<{ readonly email: string }>;
  };
  readonly authorization: {
    listOrganizationRoles(organizationId: string): Promise<{ readonly data: readonly RoleRecord[] }>;
  };
  readonly clock?: () => Date;
}

// A user has at most one membership in an organization. The limit only bounds the read.
const MEMBERSHIP_READ_LIMIT = 10;
const MEMBERSHIP_PAGE_LIMIT = 10;
const NO_MEMBERSHIPS: readonly OrganizationMembership[] = Object.freeze([]);
const APPLIED = Object.freeze({ outcome: 'applied' as const });
const UNSUPPORTED = Object.freeze({ outcome: 'unsupported' as const });
// Only this documented 422 proves that the provider refused deletion without an effect.
const DIRECTORY_MANAGED_CODES: ReadonlySet<unknown> = new Set(['organization_membership_directory_managed']);

// The organization directory of the hosted edition. Each call reads or changes WorkOS again and keeps nothing, so that
// a revoked membership or role stops access at the next request. A failed or unexpected answer throws, so that access
// fails closed and a failure never looks like a missing record or a result. A change makes at most one WorkOS write,
// and nothing repeats it.
export class WorkOSOrganizations implements OrganizationDirectory {
  // WorkOS can accept an invitation for another address of the same domain, so the directory claims no strict match.
  readonly invitationIdentityPolicy = 'provider-rules';
  private readonly authority: string;
  private readonly memberships: WorkOSOrganizationsOptions['memberships'];
  private readonly userManagement: WorkOSOrganizationsOptions['userManagement'];
  private readonly authorization: WorkOSOrganizationsOptions['authorization'];
  private readonly invitations: WorkOSInvitations;

  constructor(options: WorkOSOrganizationsOptions) {
    this.authority = options.authority;
    this.memberships = options.memberships;
    this.userManagement = options.userManagement;
    this.authorization = options.authorization;
    this.invitations = new WorkOSInvitations(options.userManagement, options.clock ?? (() => new Date()));
  }

  // The current grants of one user in one organization, for access resolution. No active membership gives undefined.
  async activeGrants(userId: string, organizationId: string): Promise<readonly RoleGrant[] | undefined> {
    const membership = await this.activeMembership(userId, organizationId);
    return membership === undefined ? undefined : this.grantsOf(membership);
  }

  // The current name of one active membership. The display read does not need any organization's role catalog.
  async activeOrganizationName(user: AuthenticatedUser, organizationId: string): Promise<string | undefined> {
    if (user.authority !== this.authority) return undefined;
    return (await this.activeMembership(user.subject, organizationId))?.organizationName;
  }

  // Each active membership of the user, from every page, with every current grant. The read names the status active,
  // so that no default filter of WorkOS decides. A user of another authority has no WorkOS membership, so its subject
  // is never sent to WorkOS.
  async membershipsOf(user: AuthenticatedUser, signal?: AbortSignal): Promise<readonly OrganizationMembership[]> {
    if (user.authority !== this.authority) return NO_MEMBERSHIPS;
    const memberships: OrganizationMembership[] = [];
    for (const record of await this.activeMembershipsOf(user.subject, signal)) {
      const { organizationId, organizationName } = record;
      memberships.push(Object.freeze({ organizationId, organizationName, active: true, grants: await this.grantsOf(record, signal) }));
    }
    return Object.freeze(memberships);
  }

  // The member and invitation work of customer administration. A page is one WorkOS list read of at most 100 records.
  // The user reads of a member page run one after the other, so that the WorkOS calls of a page are bounded and come in
  // page order.
  async memberPage(request: MemberPageRequest): Promise<Page<OrganizationMember>> {
    const { organizationId, statuses, cursor, signal } = request;
    // Without a status, WorkOS gives only active memberships.
    if (statuses.length === 0) throw new Error('A member read must name at least one membership status');
    const page = await readWhileActive(signal, () => this.memberships.listOrganizationMemberships({ organizationId, statuses: [...statuses], limit: PAGE_SIZE, ...afterOf(cursor) }));
    const records = page.data.map((record) => checkedMemberRecord(record, request));
    const organizationRoles = records.length === 0 ? [] : await this.organizationRoles(organizationId, signal);
    const members: OrganizationMember[] = [];
    for (const record of records) members.push(await this.memberOf(record, organizationRoles, signal));
    return pageOf(members, page.listMetadata.after);
  }

  async memberFactsPage(request: MemberPageRequest): Promise<Page<OrganizationMemberFacts>> {
    const { organizationId, statuses, cursor, signal } = request;
    if (statuses.length === 0) throw new Error('A member read must name at least one membership status');
    const page = await readWhileActive(signal, () => this.memberships.listOrganizationMemberships({ organizationId, statuses: [...statuses], limit: PAGE_SIZE, ...afterOf(cursor) }));
    const records = page.data.map(record => checkedMemberRecord(record, request));
    const organizationRoles = records.length === 0 ? [] : await this.organizationRoles(organizationId, signal);
    return pageOf(records.map(record => memberFactsOf(record, organizationRoles)), page.listMetadata.after);
  }

  async member(membershipId: string, signal?: AbortSignal): Promise<OrganizationMember | undefined> {
    const record = await this.currentMembership(membershipId, signal);
    return record === undefined ? undefined : this.memberOf(record, await this.organizationRoles(record.organizationId, signal), signal);
  }

  async deleteMembership(membershipId: string): Promise<MembershipDeletionResult> {
    try {
      await this.userManagement.deleteOrganizationMembership(membershipId);
    } catch (error) {
      if (hasStatus(error, 422) && hasCode(error, DIRECTORY_MANAGED_CODES)) return UNSUPPORTED;
      throw error;
    }
    return APPLIED;
  }

  invitationPage(request: InvitationPageRequest): Promise<Page<OrganizationInvitation>> {
    return this.invitations.invitationPage(request);
  }

  invitation(invitationId: string): Promise<OrganizationInvitation | undefined> {
    return this.invitations.invitation(invitationId);
  }

  sendInvitation(request: InvitationRequest): Promise<InvitationSendResult> {
    return this.invitations.sendInvitation(request);
  }

  resendInvitation(invitationId: string): Promise<InvitationUpdateResult> {
    return this.invitations.resendInvitation(invitationId);
  }

  revokeInvitation(invitationId: string): Promise<InvitationUpdateResult> {
    return this.invitations.revokeInvitation(invitationId);
  }

  private async activeMembership(userId: string, organizationId: string): Promise<MembershipRecord | undefined> {
    const page = await this.memberships.listOrganizationMemberships({ userId, organizationId, statuses: ['active'], limit: MEMBERSHIP_READ_LIMIT });
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
  private async activeMembershipsOf(userId: string, signal?: AbortSignal): Promise<readonly MembershipRecord[]> {
    const records: MembershipRecord[] = [];
    const cursors = new Set<string>();
    let after: string | undefined;
    for (let pages = 0; pages < MEMBERSHIP_PAGE_LIMIT; pages += 1) {
      const page = await readWhileActive(signal, () => this.memberships.listOrganizationMemberships({ userId, statuses: ['active'], limit: PAGE_SIZE, ...afterOf(after) }));
      records.push(...page.data.map((record) => checkedActiveRecord(record, userId)));
      const next = page.listMetadata.after;
      if (!next) return eachOrganizationOnce(records);
      if (cursors.has(next)) throw new Error('WorkOS repeated a page cursor of the memberships of one user');
      cursors.add(next);
      after = next;
    }
    throw new Error(`WorkOS gave more than ${MEMBERSHIP_PAGE_LIMIT} pages of memberships for one user`);
  }

  private async grantsOf(membership: MembershipRecord, signal?: AbortSignal): Promise<readonly RoleGrant[]> {
    const membershipRoles = roleListOf(membership);
    return grantsOfRoles(membershipRoles, await this.organizationRoles(membership.organizationId, signal), membership.organizationId);
  }

  private async organizationRoles(organizationId: string, signal?: AbortSignal): Promise<readonly RoleRecord[]> {
    return (await readWhileActive(signal, () => this.authorization.listOrganizationRoles(organizationId))).data;
  }

  // A WorkOS membership has no email, and the user list of an organization gives only the users with an active
  // membership. Thus each display member read also reads its user.
  private async memberOf(record: MembershipRecord, organizationRoles: readonly RoleRecord[], signal?: AbortSignal): Promise<OrganizationMember> {
    const facts = memberFactsOf(record, organizationRoles);
    const { email } = await readWhileActive(signal, () => this.userManagement.getUser(record.userId));
    return Object.freeze({ ...facts, email });
  }

  private async currentMembership(membershipId: string, signal?: AbortSignal): Promise<MembershipRecord | undefined> {
    const record = await readWhileActive(signal, () => unlessNotFound(() => this.memberships.getOrganizationMembership(membershipId)));
    if (record !== undefined && record.id !== membershipId) throw new Error('WorkOS answered a membership that the read did not ask for');
    return record;
  }
}

function memberFactsOf(record: MembershipRecord, organizationRoles: readonly RoleRecord[]): OrganizationMemberFacts {
  const { id: membershipId, userId: subject, organizationId, status } = record;
  const grants = grantsOfRoles(roleListOf(record), organizationRoles, organizationId);
  return Object.freeze({ membershipId, subject, organizationId, status, management: managementOf(record), grants, revision: revisionOf(record) });
}

async function readWhileActive<T>(signal: AbortSignal | undefined, read: () => Promise<T>): Promise<T> {
  signal?.throwIfAborted();
  try {
    return await read();
  } finally {
    signal?.throwIfAborted();
  }
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

function checkedMemberRecord(record: MembershipRecord, request: MemberPageRequest): MembershipRecord {
  if (record.organizationId !== request.organizationId || !request.statuses.includes(record.status)) {
    throw new Error('WorkOS answered a membership that the read did not ask for');
  }
  return record;
}

// WorkOS gives the role list only when the environment allows multiple roles for each membership.
function roleListOf(membership: MembershipRecord): readonly { readonly slug: string }[] {
  if (membership.roles === undefined) {
    throw new HostedRoleConfigurationError(`A membership in the organization ${membership.organizationId} has no role list. `
      + 'The WorkOS environment must allow multiple roles for each membership.');
  }
  return membership.roles;
}

function managementOf(membership: MembershipRecord): MembershipManagement {
  if (membership.directoryManaged === false) return 'ordinary';
  if (membership.directoryManaged === true) return 'external';
  return 'unknown';
}

// The facts distinguish a changed membership even when WorkOS gives the same update time.
function revisionOf(membership: MembershipRecord): string {
  const slugs = roleListOf(membership).map(({ slug }) => slug).sort();
  return createHash('sha256').update(JSON.stringify([membership.updatedAt, membership.status, slugs, managementOf(membership)])).digest('base64url');
}
