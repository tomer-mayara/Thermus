import { createHash } from 'node:crypto';
import type {
  ListInvitationsOptions,
  ListOrganizationMembershipsOptions,
  OrganizationMembershipStatus,
  SendInvitationOptions,
  WorkOS,
} from '@workos-inc/node';
import type { AuthenticatedUser, RoleGrant } from '../../identity/access-context.ts';
import type {
  InvitationPageRequest,
  InvitationRequest,
  InvitationSendResult,
  InvitationState,
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

interface MembershipRecord {
  readonly id: string;
  readonly userId: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly status: OrganizationMembershipStatus;
  // WorkOS changes it with each change of the roles or the status.
  readonly updatedAt: string;
  readonly directoryManaged?: unknown;
  readonly roles?: readonly { readonly slug: string }[];
}

// WorkOS also gives the token and the link of an invitation. They are credentials of the invited person, so the
// directory never copies them.
interface InvitationRecord {
  readonly id: string;
  readonly email: string;
  readonly state: InvitationState;
  readonly expiresAt: string;
  // Null for an invitation to the application, not to an organization.
  readonly organizationId: string | null;
  readonly roleSlug: string | null;
}

interface WorkOSList<T> {
  readonly data: readonly T[];
  readonly listMetadata: { readonly after?: string | null };
}

// The calls of the pinned SDK client that access resolution and organization administration need. The client fits this
// shape. Membership deletion names one exact ID. There is no user, factor, role, creation, or status writer.
export interface WorkOSOrganizationsOptions {
  readonly authority: string;
  readonly memberships: {
    listOrganizationMemberships(options: ListOrganizationMembershipsOptions): Promise<WorkOSList<MembershipRecord>>;
    getOrganizationMembership(organizationMembershipId: string): Promise<MembershipRecord>;
  };
  readonly userManagement: {
    deleteOrganizationMembership(organizationMembershipId: string): Promise<void>;
    getUser(userId: string): Promise<{ readonly email: string }>;
    listInvitations(options: ListInvitationsOptions): Promise<WorkOSList<InvitationRecord>>;
    getInvitation(invitationId: string): Promise<InvitationRecord>;
    sendInvitation(options: SendInvitationOptions): Promise<InvitationRecord>;
    resendInvitation(invitationId: string): Promise<InvitationRecord>;
    revokeInvitation(invitationId: string): Promise<InvitationRecord>;
  };
  readonly authorization: {
    listOrganizationRoles(organizationId: string): Promise<{ readonly data: readonly RoleRecord[] }>;
  };
  readonly clock?: () => Date;
}

// A user has at most one membership in an organization. The limit only bounds the read.
const MEMBERSHIP_READ_LIMIT = 10;
// The largest page that WorkOS gives.
const PAGE_SIZE = 100;
const MEMBERSHIP_PAGE_LIMIT = 10;
const NO_MEMBERSHIPS: readonly OrganizationMembership[] = Object.freeze([]);
const APPLIED = Object.freeze({ outcome: 'applied' as const });
const UNSUPPORTED = Object.freeze({ outcome: 'unsupported' as const });
// Only this documented 422 proves that the provider refused deletion without an effect.
const DIRECTORY_MANAGED_CODES: ReadonlySet<unknown> = new Set(['organization_membership_directory_managed']);
const ADDRESS_IN_USE = Object.freeze({ outcome: 'address-in-use' as const });
const NOT_PENDING = Object.freeze({ outcome: 'not-pending' as const });
// WorkOS refuses a send to an address that has a pending invitation of the organization, for any role and in any
// letter case, and a send to the address of an active member, each with 400 and one of these codes.
const ADDRESS_IN_USE_CODES: ReadonlySet<unknown> = new Set(['email_already_invited_to_organization', 'user_already_organization_member']);

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
  private readonly clock: () => Date;

  constructor(options: WorkOSOrganizationsOptions) {
    this.authority = options.authority;
    this.memberships = options.memberships;
    this.userManagement = options.userManagement;
    this.authorization = options.authorization;
    this.clock = options.clock ?? (() => new Date());
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

  // WorkOS has no state filter for invitations, so the read keeps only the states that it names.
  async invitationPage(request: InvitationPageRequest): Promise<Page<OrganizationInvitation>> {
    const { organizationId, states, cursor } = request;
    if (states.length === 0) throw new Error('An invitation read must name at least one invitation state');
    const page = await this.userManagement.listInvitations({ organizationId, limit: PAGE_SIZE, ...afterOf(cursor) });
    const now = this.clock();
    const invitations: OrganizationInvitation[] = [];
    for (const record of page.data) {
      if (record.organizationId !== organizationId) throw new Error('WorkOS answered an invitation that the read did not ask for');
      const state = invitationStateOf(record, now);
      if (states.includes(state)) invitations.push(invitationOf(record, organizationId, state));
    }
    return pageOf(invitations, page.listMetadata.after);
  }

  // An invitation without an organization is not an organization invitation, so it gives undefined.
  async invitation(invitationId: string): Promise<OrganizationInvitation | undefined> {
    const record = await this.currentInvitation(invitationId);
    if (record?.organizationId == null) return undefined;
    return invitationOf(record, record.organizationId, invitationStateOf(record, this.clock()));
  }

  // When WorkOS answers, the send happened. Thus an answer that is not the invitation of the request throws, because the
  // effect of the send is not known.
  async sendInvitation(request: InvitationRequest): Promise<InvitationSendResult> {
    const { organizationId, email, role } = request;
    let sent: InvitationRecord;
    try {
      sent = await this.userManagement.sendInvitation({ email, organizationId, roleSlug: role });
    } catch (error) {
      if (hasStatus(error, 400) && hasCode(error, ADDRESS_IN_USE_CODES)) return ADDRESS_IN_USE;
      throw error;
    }
    if (!isInvitationOf(sent, request)) throw new Error('WorkOS answered the send with an invitation that the send did not ask for');
    return APPLIED;
  }

  async resendInvitation(invitationId: string): Promise<InvitationUpdateResult> {
    return this.changeInvitation(invitationId, 'pending', () => this.userManagement.resendInvitation(invitationId));
  }

  async revokeInvitation(invitationId: string): Promise<InvitationUpdateResult> {
    return this.changeInvitation(invitationId, 'revoked', () => this.userManagement.revokeInvitation(invitationId));
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

  // WorkOS refuses a change of an invitation that is not pending with 400, but 400 can have other causes. Thus a read of
  // the invitation decides: only an invitation that exists and is no longer pending gives not-pending. The answer of a
  // change must be the invitation in the state after the change, else the effect of the change is not known.
  private async changeInvitation(invitationId: string, stateAfter: InvitationState, change: () => Promise<InvitationRecord>): Promise<InvitationUpdateResult> {
    let changed: InvitationRecord;
    try {
      changed = await change();
    } catch (error) {
      if (hasStatus(error, 400) && await this.isNoLongerPending(invitationId)) return NOT_PENDING;
      throw error;
    }
    if (changed.id !== invitationId || changed.state !== stateAfter) throw new Error('WorkOS answered the change with an invitation that the change did not ask for');
    return APPLIED;
  }

  private async isNoLongerPending(invitationId: string): Promise<boolean> {
    const record = await this.currentInvitation(invitationId);
    return record !== undefined && invitationStateOf(record, this.clock()) !== 'pending';
  }

  private async currentInvitation(invitationId: string): Promise<InvitationRecord | undefined> {
    const record = await unlessNotFound(() => this.userManagement.getInvitation(invitationId));
    if (record !== undefined && record.id !== invitationId) throw new Error('WorkOS answered an invitation that the read did not ask for');
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

// WorkOS can still give the state pending after the expiry time, so the clock decides.
function invitationStateOf(record: InvitationRecord, now: Date): InvitationState {
  if (record.state !== 'pending') return record.state;
  const expiresAt = Date.parse(record.expiresAt);
  if (Number.isNaN(expiresAt)) throw new Error('WorkOS answered a pending invitation without a valid expiry time');
  return expiresAt <= now.getTime() ? 'expired' : 'pending';
}

// WorkOS gives the current role of the membership of an invitation. Thus only the role of a pending invitation is the
// role that its acceptance gives.
function invitationOf(record: InvitationRecord, organizationId: string, state: InvitationState): OrganizationInvitation {
  const role = record.roleSlug;
  if (!role) throw new Error('WorkOS answered an organization invitation without a role');
  return Object.freeze({ invitationId: record.id, organizationId, email: record.email, role, state, expiresAt: record.expiresAt });
}

// WorkOS compares addresses without letter case.
function isInvitationOf(record: InvitationRecord, request: InvitationRequest): boolean {
  return record.state === 'pending' && record.organizationId === request.organizationId && record.roleSlug === request.role
    && record.email.toLowerCase() === request.email.toLowerCase();
}

function afterOf(cursor: string | undefined): { readonly after?: string } {
  return cursor === undefined ? {} : { after: cursor };
}

// WorkOS gives the cursor of the next page in its list metadata. The last page has none, or an empty one.
function pageOf<T>(records: readonly T[], after: string | null | undefined): Page<T> {
  const items = Object.freeze([...records]);
  return Object.freeze(typeof after === 'string' && after !== '' ? { items, next: after } : { items });
}

// A WorkOS 404 means that the record does not exist. Each other failure reaches the caller.
async function unlessNotFound<T>(read: () => Promise<T>): Promise<T | undefined> {
  try {
    return await read();
  } catch (error) {
    if (hasStatus(error, 404)) return undefined;
    throw error;
  }
}

// The SDK gives the status and the code of a WorkOS answer on its errors, for example on NotFoundException,
// BadRequestException, and GenericServerException. Thus the directory reads them by shape, not by class.
function hasStatus(error: unknown, status: number): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === status;
}

function hasCode(error: unknown, codes: ReadonlySet<unknown>): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && codes.has(error.code);
}


interface MembershipWireRecord {
  readonly id: string;
  readonly user_id: string;
  readonly organization_id: string;
  readonly organization_name: string;
  readonly status: OrganizationMembershipStatus;
  readonly updated_at: string;
  readonly directory_managed?: unknown;
  readonly roles?: MembershipRecord['roles'];
}

// SDK 11 defaults missing or null management evidence to false. Read it through the same client's transport before
// that default can make unknown evidence look ordinary. Each read still sends only one GET.
export function workosMembershipReads(workos: Pick<WorkOS, 'get'>): WorkOSOrganizationsOptions['memberships'] {
  return {
    async getOrganizationMembership(membershipId) {
      const id = encodeURIComponent(membershipId).replace(/%3A/gi, ':');
      if (id === '.' || id === '..') throw new TypeError('Invalid membership path segment');
      const { data } = await workos.get<MembershipWireRecord>(`/user_management/organization_memberships/${id}`);
      return membershipRecordOf(data);
    },
    async listOrganizationMemberships(options) {
      const query = { user_id: options.userId, organization_id: options.organizationId, statuses: options.statuses?.join(','), limit: options.limit, before: options.before, after: options.after, order: options.order || 'desc' };
      const { data } = await workos.get<{ readonly data: readonly MembershipWireRecord[]; readonly list_metadata: WorkOSList<MembershipRecord>['listMetadata'] }>('/user_management/organization_memberships', { query });
      return { data: data.data.map(membershipRecordOf), listMetadata: data.list_metadata };
    },
  };
}

function membershipRecordOf(record: MembershipWireRecord): MembershipRecord {
  return { id: record.id, userId: record.user_id, organizationId: record.organization_id, organizationName: record.organization_name, status: record.status, updatedAt: record.updated_at, directoryManaged: record.directory_managed, roles: record.roles };
}
