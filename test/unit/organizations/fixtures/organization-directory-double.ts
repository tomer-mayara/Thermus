import type { AuthenticatedUser, RoleGrant } from '../../../../src/auth/access-context.ts';
import type {
  DirectoryChangeResult,
  DirectoryGrantChange,
  InvitationIdentityPolicy,
  InvitationPageRequest,
  InvitationRequest,
  InvitationSendResult,
  InvitationState,
  InvitationUpdateResult,
  MemberPageRequest,
  MembershipStatus,
  OrganizationDirectory,
  OrganizationInvitation,
  OrganizationMember,
  OrganizationMembership,
  Page,
} from '../../../../src/organizations/organization-administration.ts';

export type ConfiguredMemberships = readonly OrganizationMembership[] | Error;

export interface MemberSeed {
  readonly subject: string;
  readonly organizationId: string;
  readonly organizationName?: string;
  readonly status?: MembershipStatus;
  readonly grants: readonly RoleGrant[];
  readonly membershipId?: string;
  readonly email?: string;
}

export interface InvitationSeed {
  readonly organizationId: string;
  readonly email: string;
  readonly role: string;
  readonly state?: InvitationState;
  readonly invitationId?: string;
}

export type ChangeOperation = 'changeGrant' | 'sendInvitation' | 'resendInvitation' | 'revokeInvitation';

// The next answer of a change: a result without a change, or a failure before or after the change.
export type Override = { readonly result: 'unsupported' | 'stale' | 'not-pending' } | { readonly error: Error; readonly afterChange?: boolean };

// Lays out the records that match a page request on pages; an Error is a page that fails.
export type PageLayout<T> = (records: readonly T[]) => ReadonlyArray<readonly T[] | Error>;

interface MemberState {
  readonly membershipId: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly subject: string;
  readonly email: string;
  status: MembershipStatus;
  grants: readonly RoleGrant[];
  revision: number;
}

interface InvitationRecord {
  readonly invitationId: string;
  readonly organizationId: string;
  readonly email: string;
  readonly role: string;
  state: InvitationState;
  // A credential of the invited person. The double gives it with each invitation, as a provider record has it, so that
  // a test can show that it reaches no page or record.
  readonly token: string;
}

export const defaultRoleGrants: ReadonlyMap<string, RoleGrant> = new Map([
  ['user', { role: 'user', permissions: ['product:access'] }],
  ['admin', { role: 'admin', permissions: ['user-grants:manage'] }],
  ['super-admin', { role: 'super-admin', permissions: ['admin-grants:manage', 'billing:manage'] }],
]);
// The role that the provider gives a membership without another role. It gives no application permission.
export const memberRole: RoleGrant = { role: 'member', permissions: [] };

export function emailOf(subject: string): string {
  return `${subject.replace(/^user-/, '')}@example.com`;
}

export function membershipIdOf(subject: string, organizationId: string): string {
  return `membership-${subject}-${organizationId}`;
}

// A stateful provider directory: changes take effect in the later reads, as in the provider. Each grant change
// needs the current revision of the membership. A test can lay out the pages of each read, make a page or a change
// fail, give a change another result, or hold the changes to run them at the same time.
export class OrganizationDirectoryDouble implements OrganizationDirectory {
  readonly membershipReads: AuthenticatedUser[] = [];
  readonly memberPageReads: MemberPageRequest[] = [];
  readonly memberReads: string[] = [];
  readonly grantChanges: DirectoryGrantChange[] = [];
  readonly invitationPageReads: InvitationPageRequest[] = [];
  readonly invitationReads: string[] = [];
  readonly invitationChanges: string[] = [];
  invitationIdentityPolicy: InvitationIdentityPolicy = 'invited-address';
  pageSize = 2;
  memberPageLayout?: PageLayout<OrganizationMember>;
  invitationPageLayout?: PageLayout<OrganizationInvitation>;
  // A directory of another authority knows no user of this one.
  authority?: string;
  private members: MemberState[] = [];
  private readonly invitations: InvitationRecord[] = [];
  private readonly membershipFailures = new Map<string, Error>();
  private readonly overrides = new Map<ChangeOperation, Override[]>();
  private membershipOutage?: Error;
  private held?: Promise<void>;
  private invitationCount = 0;

  constructor(memberships: ReadonlyMap<string, ConfiguredMemberships> = new Map()) {
    for (const [subject, configured] of memberships) this.configure(subject, configured);
  }

  // Replaces the memberships of one user, or makes the reads of its memberships fail.
  configure(subject: string, memberships: ConfiguredMemberships): void {
    this.members = this.members.filter((member) => member.subject !== subject);
    this.membershipFailures.delete(subject);
    if (memberships instanceof Error) this.membershipFailures.set(subject, memberships);
    else this.addMembers(...memberships.map((membership): MemberSeed => ({ subject, ...membership, status: membership.active ? 'active' : 'inactive' })));
  }

  addMembers(...seeds: readonly MemberSeed[]): void {
    for (const seed of seeds) this.members.push(stateOf(seed));
  }

  replaceMembers(seeds: readonly MemberSeed[]): void {
    this.members = seeds.map(stateOf);
  }

  addInvitations(...seeds: readonly InvitationSeed[]): void {
    for (const seed of seeds) this.invitations.push(this.invitationOf(seed));
  }

  failMembershipReads(outage: Error | undefined): void {
    this.membershipOutage = outage;
  }

  queue(operation: ChangeOperation, ...overrides: readonly Override[]): void {
    this.overrides.set(operation, [...(this.overrides.get(operation) ?? []), ...overrides]);
  }

  // Holds each change until the returned function runs, so that several changes can wait at the same time.
  holdChanges(): () => void {
    const release = Promise.withResolvers<void>();
    this.held = release.promise;
    return () => {
      this.held = undefined;
      release.resolve();
    };
  }

  membershipIn(subject: string, organizationId: string): OrganizationMember | undefined {
    const state = this.members.find((member) => member.subject === subject && member.organizationId === organizationId);
    return state === undefined ? undefined : memberOf(state);
  }

  invitationTo(email: string): (OrganizationInvitation & { readonly token: string }) | undefined {
    const record = this.invitations.findLast((invitation) => invitation.email === email);
    return record === undefined ? undefined : { ...record };
  }

  // The provider owns the acceptance: the membership gets only the role of the invitation, and an inactive
  // membership becomes active again.
  acceptInvitation(invitationId: string, subject: string): void {
    const invitation = this.invitationWithId(invitationId);
    if (invitation.state !== 'pending') throw new Error(`The invitation ${invitationId} is ${invitation.state}`);
    invitation.state = 'accepted';
    const grant = roleGrantOf(invitation.role);
    const member = this.members.find((state) => state.subject === subject && state.organizationId === invitation.organizationId);
    if (member === undefined) {
      this.addMembers({ subject, organizationId: invitation.organizationId, grants: [grant], email: invitation.email });
      return;
    }
    member.status = 'active';
    member.grants = withRole(member.grants, grant);
    member.revision += 1;
  }

  expireInvitation(invitationId: string): void {
    this.invitationWithId(invitationId).state = 'expired';
  }

  async membershipsOf(user: AuthenticatedUser): Promise<readonly OrganizationMembership[]> {
    this.membershipReads.push(user);
    const failure = this.membershipOutage ?? this.membershipFailures.get(user.subject);
    if (failure !== undefined) throw failure;
    if (this.authority !== undefined && user.authority !== this.authority) return [];
    return this.members.filter((member) => member.subject === user.subject).map(({ organizationId, organizationName, status, grants }) => ({
      organizationId,
      organizationName,
      active: status === 'active',
      grants,
    }));
  }

  async memberPage(request: MemberPageRequest): Promise<Page<OrganizationMember>> {
    this.memberPageReads.push(request);
    const matching = this.members
      .filter((member) => member.organizationId === request.organizationId && request.statuses.includes(member.status))
      .map(memberOf);
    return pageAt(this.memberPageLayout?.(matching) ?? chunks(matching, this.pageSize), request.cursor);
  }

  async member(membershipId: string): Promise<OrganizationMember | undefined> {
    this.memberReads.push(membershipId);
    const state = this.members.find((member) => member.membershipId === membershipId);
    return state === undefined ? undefined : memberOf(state);
  }

  async changeGrant(change: DirectoryGrantChange): Promise<DirectoryChangeResult> {
    this.grantChanges.push(change);
    return this.answer('changeGrant', () => this.applyGrantChange(change));
  }

  async invitationPage(request: InvitationPageRequest): Promise<Page<OrganizationInvitation>> {
    this.invitationPageReads.push(request);
    const matching = this.invitations
      .filter((invitation) => invitation.organizationId === request.organizationId && request.states.includes(invitation.state))
      .map((invitation) => ({ ...invitation }));
    return pageAt(this.invitationPageLayout?.(matching) ?? chunks(matching, this.pageSize), request.cursor);
  }

  async invitation(invitationId: string): Promise<OrganizationInvitation | undefined> {
    this.invitationReads.push(invitationId);
    const record = this.invitations.find((invitation) => invitation.invitationId === invitationId);
    return record === undefined ? undefined : { ...record };
  }

  async sendInvitation(request: InvitationRequest): Promise<InvitationSendResult> {
    this.invitationChanges.push(`send ${request.organizationId} ${request.role} ${request.email}`);
    return this.answer('sendInvitation', () => {
      const invitation = this.invitationOf(request);
      this.invitations.push(invitation);
      return { outcome: 'sent', invitationId: invitation.invitationId };
    });
  }

  async resendInvitation(invitationId: string): Promise<InvitationUpdateResult> {
    this.invitationChanges.push(`resend ${invitationId}`);
    return this.answer('resendInvitation', () => (this.invitationWithId(invitationId).state === 'pending' ? { outcome: 'applied' } : { outcome: 'not-pending' }));
  }

  async revokeInvitation(invitationId: string): Promise<InvitationUpdateResult> {
    this.invitationChanges.push(`revoke ${invitationId}`);
    return this.answer('revokeInvitation', () => {
      const invitation = this.invitationWithId(invitationId);
      if (invitation.state !== 'pending') return { outcome: 'not-pending' };
      invitation.state = 'revoked';
      return { outcome: 'applied' };
    });
  }

  private async answer<T>(operation: ChangeOperation, change: () => T): Promise<T> {
    await this.held;
    const override = this.overrides.get(operation)?.shift();
    if (override === undefined) return change();
    if ('result' in override) return { outcome: override.result } as T;
    if (override.afterChange === true) change();
    throw override.error;
  }

  private applyGrantChange(change: DirectoryGrantChange): DirectoryChangeResult {
    const member = this.members.find((state) => state.membershipId === change.membershipId);
    if (member === undefined) throw new Error(`No membership ${change.membershipId}`);
    if (`r${member.revision}` !== change.revision) return { outcome: 'stale' };
    member.grants = change.action === 'grant' ? withRole(member.grants, roleGrantOf(change.role)) : withoutRole(member.grants, change.role);
    member.revision += 1;
    return { outcome: 'applied' };
  }

  private invitationWithId(invitationId: string): InvitationRecord {
    const invitation = this.invitations.find((record) => record.invitationId === invitationId);
    if (invitation === undefined) throw new Error(`No invitation ${invitationId}`);
    return invitation;
  }

  private invitationOf(seed: InvitationSeed): InvitationRecord {
    this.invitationCount += 1;
    const invitationId = seed.invitationId ?? `invitation-${this.invitationCount}`;
    return { invitationId, organizationId: seed.organizationId, email: seed.email, role: seed.role, state: seed.state ?? 'pending', token: `${invitationId}-secret-token` };
  }
}

function stateOf(seed: MemberSeed): MemberState {
  return {
    membershipId: seed.membershipId ?? membershipIdOf(seed.subject, seed.organizationId),
    organizationId: seed.organizationId,
    organizationName: seed.organizationName ?? `Organization ${seed.organizationId}`,
    subject: seed.subject,
    email: seed.email ?? emailOf(seed.subject),
    status: seed.status ?? 'active',
    grants: seed.grants,
    revision: 1,
  };
}

function memberOf(state: MemberState): OrganizationMember {
  const { membershipId, organizationId, subject, email, status, grants, revision } = state;
  return { membershipId, organizationId, subject, email, status, grants, revision: `r${revision}` };
}

function roleGrantOf(role: string): RoleGrant {
  const grant = defaultRoleGrants.get(role);
  if (grant === undefined) throw new Error(`The directory has no role ${role}`);
  return grant;
}

function withRole(grants: readonly RoleGrant[], grant: RoleGrant): readonly RoleGrant[] {
  const others = grants.filter((current) => current.role !== grant.role && current.role !== memberRole.role);
  return [...others, grant];
}

// Without another role, the membership keeps the default role, which gives no application permission.
function withoutRole(grants: readonly RoleGrant[], role: string): readonly RoleGrant[] {
  const remaining = grants.filter((grant) => grant.role !== role);
  return remaining.length === 0 ? [memberRole] : remaining;
}

function chunks<T>(records: readonly T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let start = 0; start < records.length; start += size) pages.push(records.slice(start, start + size));
  return pages.length === 0 ? [[]] : pages;
}

function pageAt<T>(pages: ReadonlyArray<readonly T[] | Error>, cursor: string | undefined): Page<T> {
  const index = cursor === undefined ? 0 : Number(/^page-(\d+)$/.exec(cursor)?.[1] ?? Number.NaN);
  const page = pages[index];
  if (page === undefined) throw new Error(`No page for the cursor ${cursor}`);
  if (page instanceof Error) throw page;
  return index + 1 < pages.length ? { items: page, next: `page-${index + 1}` } : { items: page };
}
