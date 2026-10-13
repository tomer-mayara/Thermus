import type { AuthenticatedUser, RoleGrant } from '../auth/access-context.ts';

export interface OrganizationMembership {
  readonly organizationId: string;
  readonly organizationName: string;
  readonly active: boolean;
  readonly grants: readonly RoleGrant[];
}

export type MembershipStatus = 'active' | 'inactive' | 'pending';

// A membership of an organization for administration work. The revision changes with each change of the membership, so
// that a change can require the state that the actor saw.
export interface OrganizationMember {
  readonly membershipId: string;
  readonly organizationId: string;
  readonly subject: string;
  readonly email: string;
  readonly status: MembershipStatus;
  readonly grants: readonly RoleGrant[];
  readonly revision: string;
}

export type InvitationState = 'pending' | 'accepted' | 'revoked' | 'expired';

// An invitation holds no token or link, because they are credentials of the invited person.
export interface OrganizationInvitation {
  readonly invitationId: string;
  readonly organizationId: string;
  readonly email: string;
  // The one role that the acceptance grants.
  readonly role: string;
  readonly state: InvitationState;
}

// Who can accept an invitation, as the directory enforces it. 'invited-address': only a sign-in with the invited
// address. 'provider-rules': the provider can also accept another identity under its own rules, for example another
// address of the same domain.
export type InvitationIdentityPolicy = 'invited-address' | 'provider-rules';

export interface Page<T> {
  readonly items: readonly T[];
  // The cursor of the next page. The last page has none.
  readonly next?: string;
}

// Each read names the statuses or states that it wants, so that no default filter of the provider decides.
export interface MemberPageRequest {
  readonly organizationId: string;
  readonly statuses: readonly MembershipStatus[];
  readonly cursor?: string;
}

export interface InvitationPageRequest {
  readonly organizationId: string;
  readonly states: readonly InvitationState[];
  readonly cursor?: string;
}

// The customer roles that a grant change or an invitation can give. Only the operator manages Super Admin.
export type AssignableRole = 'user' | 'admin';

export type GrantAction = 'grant' | 'revoke';

export interface DirectoryGrantChange {
  readonly membershipId: string;
  readonly role: AssignableRole;
  readonly action: GrantAction;
  // The directory makes the change only while the membership has this revision.
  readonly revision: string;
}

// 'applied': the directory added or removed only this role, on the revision of the change. 'stale': the membership
// has another revision now, so nothing changed. 'unsupported': the directory cannot make the change safely, so nothing
// changed.
export interface DirectoryChangeResult {
  readonly outcome: 'applied' | 'stale' | 'unsupported';
}

export interface InvitationRequest {
  readonly organizationId: string;
  readonly email: string;
  // The invitation gives only this role, so that an Admin invitation gives no User access.
  readonly role: AssignableRole;
}

export type InvitationSendResult = { readonly outcome: 'sent'; readonly invitationId: string } | { readonly outcome: 'unsupported' };

// 'not-pending': the invitation is accepted, revoked, or expired, so nothing changed.
export interface InvitationUpdateResult {
  readonly outcome: 'applied' | 'not-pending' | 'unsupported';
}

// The organization reads and changes of customer organization work. An implementation reads the current provider
// state for each call. A membership comes with every current grant, and a grant holds only application permissions,
// so that a default role, which gives none, authorizes nothing. A failed read or change throws, so that a failure never
// looks like a missing record or a result. After such a failure, the effect of a change is not known.
export interface OrganizationDirectory {
  // Only the memberships of the user that it gets.
  membershipsOf(user: AuthenticatedUser): Promise<readonly OrganizationMembership[]>;
  memberPage(request: MemberPageRequest): Promise<Page<OrganizationMember>>;
  // The membership with this ID in any organization, or undefined.
  member(membershipId: string): Promise<OrganizationMember | undefined>;
  changeGrant(change: DirectoryGrantChange): Promise<DirectoryChangeResult>;
  invitationPage(request: InvitationPageRequest): Promise<Page<OrganizationInvitation>>;
  // The invitation with this ID in any organization, or undefined.
  invitation(invitationId: string): Promise<OrganizationInvitation | undefined>;
  // The directory sends the invitation and owns its acceptance and the activation of the membership.
  sendInvitation(request: InvitationRequest): Promise<InvitationSendResult>;
  // Each changes only a pending invitation.
  resendInvitation(invitationId: string): Promise<InvitationUpdateResult>;
  revokeInvitation(invitationId: string): Promise<InvitationUpdateResult>;
  readonly invitationIdentityPolicy: InvitationIdentityPolicy;
}

// The person who asks for an administration operation, with the evidence of its browser session.
export interface Actor {
  readonly user: AuthenticatedUser;
  // True only when the sign-in of the session completed a multi-factor challenge.
  readonly mfaCompleted: boolean;
}

// The role and the action come from a request, so the service checks them: only a grant or a revoke of User or Admin
// is a customer change.
export interface GrantChangeRequest {
  readonly organizationId: string;
  readonly membershipId: string;
  readonly role: string;
  readonly action: string;
  // The revision of the membership that the actor saw.
  readonly revision: string;
}

export interface InvitationSendRequest {
  readonly organizationId: string;
  readonly email: string;
  readonly role: string;
}

export interface InvitationChangeRequest {
  readonly organizationId: string;
  readonly invitationId: string;
}

// 'unchanged': the membership already had the requested grants, so no change was necessary.
export type ChangeResult = 'applied' | 'unchanged' | 'denied' | 'mfa-required' | 'stale' | 'not-pending' | 'unsupported';

// A record also keeps the outcome of a change that failed: 'failed' before the directory change started, so that
// nothing changed, and 'unknown' during the directory change, so that its effect is not known.
export type ChangeOutcome = ChangeResult | 'failed' | 'unknown';

export type ChangeTarget = { readonly membershipId: string } | { readonly invitationId: string } | { readonly email: string };

// A basic record of a privileged change. It holds no credential.
export interface ChangeRecord {
  // The time of the outcome, in ISO 8601 UTC.
  readonly time: string;
  readonly actor: { readonly authority: string; readonly subject: string };
  readonly organizationId: string;
  readonly target: ChangeTarget;
  // 'grant', 'revoke', 'invite', 'resend-invitation', 'revoke-invitation', or the requested action that was denied.
  readonly action: string;
  readonly role?: string;
  readonly outcome: ChangeOutcome;
}

export interface ChangeRecorder {
  record(entry: ChangeRecord): void;
}

export type AdministrationRefusal = 'denied' | 'mfa-required';

export interface MemberChange {
  readonly role: AssignableRole;
  readonly action: GrantAction;
}

export interface MemberEntry {
  readonly membershipId: string;
  readonly email: string;
  readonly status: MembershipStatus;
  // The roles of the grants that give an application permission.
  readonly roles: readonly string[];
  readonly revision: string;
  // The changes that the actor can make now.
  readonly changes: readonly MemberChange[];
}

export interface MemberOverview {
  readonly organizationId: string;
  readonly members: readonly MemberEntry[];
  // The active memberships with User, each counted once.
  readonly activeUserSeats: number;
}

export type InvitationChange = 'resend' | 'revoke';

export interface InvitationEntry {
  readonly invitationId: string;
  readonly email: string;
  readonly role: string;
  readonly state: InvitationState;
  // The changes that the actor can make now.
  readonly changes: readonly InvitationChange[];
}

export interface InvitationOverview {
  readonly organizationId: string;
  readonly invitations: readonly InvitationEntry[];
  // The roles that the actor can invite.
  readonly invitableRoles: readonly AssignableRole[];
  readonly identityPolicy: InvitationIdentityPolicy;
}

export interface AuthorizedOrganization {
  readonly organizationId: string;
  readonly organizationName: string;
  // The browser session of the user selected this organization.
  readonly selected: boolean;
}

export interface OrganizationAdministrationOptions {
  readonly directory: OrganizationDirectory;
  readonly records: ChangeRecorder;
  readonly clock?: () => Date;
}

const ASSIGNABLE_ROLES: readonly AssignableRole[] = Object.freeze(['user', 'admin']);
// The permission that an actor needs in the organization to grant, revoke, or invite each customer role. No customer
// permission manages Super Admin.
const MANAGING_PERMISSION: Readonly<Record<AssignableRole, string>> = Object.freeze({ user: 'user-grants:manage', admin: 'admin-grants:manage' });
const GRANT_ACTIONS: readonly GrantAction[] = Object.freeze(['grant', 'revoke']);
const MEMBER_STATUSES: readonly MembershipStatus[] = Object.freeze(['active', 'inactive', 'pending']);
const INVITATION_STATES: readonly InvitationState[] = Object.freeze(['pending', 'accepted', 'revoked', 'expired']);
const GRANT_RESULTS: ReadonlyMap<string, ChangeResult> = new Map([['applied', 'applied'], ['stale', 'stale'], ['unsupported', 'unsupported']]);
const SEND_RESULTS: ReadonlyMap<string, ChangeResult> = new Map([['sent', 'applied'], ['unsupported', 'unsupported']]);
const UPDATE_RESULTS: ReadonlyMap<string, ChangeResult> = new Map([['applied', 'applied'], ['not-pending', 'not-pending'], ['unsupported', 'unsupported']]);
const PAGE_LIMIT = 1_000;

// The rest of a change after its checks: its one directory change, which gives the result.
type DirectoryChange = () => Promise<ChangeResult>;

// The record of a change in progress. The role of an invitation change is known after the invitation is read.
interface ChangeEntry {
  readonly actor: Actor;
  readonly organizationId: string;
  readonly target: ChangeTarget;
  readonly action: string;
  role?: string;
}

// Customer organization work: the onboarding, listing, and selection of the organizations of the signed-in user, and
// the User and Admin grants, the invitations, and the User seats of an organization. Each operation reads the current
// actor and target state for the organization of the request, and each change keeps a record. The external operator
// sets up organizations and their Super Admins outside this service, so it has no method for them.
export class OrganizationAdministration {
  private readonly directory: OrganizationDirectory;
  private readonly records: ChangeRecorder;
  private readonly clock: () => Date;

  constructor(options: OrganizationAdministrationOptions) {
    this.directory = options.directory;
    this.records = options.records;
    this.clock = options.clock ?? (() => new Date());
  }

  // Only active memberships whose grants give at least one application permission, because a default role gives none.
  // An empty list means that the user must accept an invitation or ask the operator: no default organization exists.
  async listOrganizations(user: AuthenticatedUser): Promise<readonly AuthorizedOrganization[]> {
    const memberships = await this.directory.membershipsOf(user);
    return Object.freeze(memberships.filter(isAuthorized).map((membership) => Object.freeze({
      organizationId: membership.organizationId,
      organizationName: membership.organizationName,
      selected: membership.organizationId === user.selectedOrganizationId,
    })));
  }

  // The organization ID comes from the request, so only the current memberships of the user can authorize it.
  async authorizeSelection(user: AuthenticatedUser, organizationId: string): Promise<AuthorizedOrganization | undefined> {
    const organizations = await this.listOrganizations(user);
    return organizations.find((organization) => organization.organizationId === organizationId);
  }

  // The members of the organization, each with the changes that the actor can make, and the active User seats. A
  // failed page fails the overview, so that no partial count is shown.
  async memberOverview(actor: Actor, organizationId: string): Promise<MemberOverview | AdministrationRefusal> {
    const authority = await this.authorityOf(actor, organizationId);
    if (typeof authority === 'string') return authority;
    const pages = await everyPage((cursor) => this.directory.memberPage({ organizationId, statuses: MEMBER_STATUSES, cursor }));
    const members = latestOfEach(pages, ({ membershipId }) => membershipId).filter((member) => member.organizationId === organizationId);
    return deepFreeze({
      organizationId,
      members: members.map((member) => memberEntry(member, authority)),
      activeUserSeats: members.filter(holdsUserSeat).length,
    });
  }

  // A grant or a revoke of one customer role of one active membership of the organization. The actor needs the
  // authority for that role there now, and the membership must still have the revision that the actor saw. The
  // directory changes only that role, so that each grant outside the authority of the actor stays.
  async changeGrant(actor: Actor, request: GrantChangeRequest): Promise<ChangeResult> {
    const target = { membershipId: request.membershipId };
    const entry: ChangeEntry = { actor, organizationId: request.organizationId, target, action: request.action, role: request.role };
    return this.recordedChange(entry, () => this.checkedGrantChange(actor, request));
  }

  async invitationOverview(actor: Actor, organizationId: string): Promise<InvitationOverview | AdministrationRefusal> {
    const authority = await this.authorityOf(actor, organizationId);
    if (typeof authority === 'string') return authority;
    const pages = await everyPage((cursor) => this.directory.invitationPage({ organizationId, states: INVITATION_STATES, cursor }));
    const invitations = latestOfEach(pages, ({ invitationId }) => invitationId).filter((invitation) => invitation.organizationId === organizationId);
    return deepFreeze({
      organizationId,
      invitations: invitations.map((invitation) => invitationEntry(invitation, authority)),
      invitableRoles: [...authority],
      identityPolicy: this.directory.invitationIdentityPolicy,
    });
  }

  // An invitation of the organization gives only the role that it names, so that an Admin invitation gives no User
  // access. The directory owns the acceptance.
  async sendInvitation(actor: Actor, request: InvitationSendRequest): Promise<ChangeResult> {
    const entry: ChangeEntry = { actor, organizationId: request.organizationId, target: { email: request.email }, action: 'invite', role: request.role };
    return this.recordedChange(entry, async () => {
      const authority = await this.authorityOf(actor, request.organizationId);
      if (typeof authority === 'string') return authority;
      const role = authority.find((candidate) => candidate === request.role);
      if (role === undefined) return 'denied';
      const invitation = { organizationId: request.organizationId, email: request.email, role };
      return async () => explicitResult(await this.directory.sendInvitation(invitation), SEND_RESULTS);
    });
  }

  async resendInvitation(actor: Actor, request: InvitationChangeRequest): Promise<ChangeResult> {
    return this.changeInvitation(actor, request, 'resend');
  }

  async revokeInvitation(actor: Actor, request: InvitationChangeRequest): Promise<ChangeResult> {
    return this.changeInvitation(actor, request, 'revoke');
  }

  private async checkedGrantChange(actor: Actor, request: GrantChangeRequest): Promise<ChangeResult | DirectoryChange> {
    const authority = await this.authorityOf(actor, request.organizationId);
    if (typeof authority === 'string') return authority;
    const role = authority.find((candidate) => candidate === request.role);
    const action = GRANT_ACTIONS.find((candidate) => candidate === request.action);
    if (role === undefined || action === undefined) return 'denied';
    const target = await this.directory.member(request.membershipId);
    if (target?.organizationId !== request.organizationId || target.status !== 'active') return 'denied';
    if (target.revision !== request.revision) return 'stale';
    if (hasRole(target, role) === (action === 'grant')) return 'unchanged';
    const change = { membershipId: target.membershipId, role, action, revision: target.revision };
    return async () => explicitResult(await this.directory.changeGrant(change), GRANT_RESULTS);
  }

  // A resend or a revoke of a pending invitation of the organization, for a role of the authority of the actor.
  private async changeInvitation(actor: Actor, request: InvitationChangeRequest, change: InvitationChange): Promise<ChangeResult> {
    const entry: ChangeEntry = { actor, organizationId: request.organizationId, target: { invitationId: request.invitationId }, action: `${change}-invitation` };
    return this.recordedChange(entry, async () => {
      const authority = await this.authorityOf(actor, request.organizationId);
      if (typeof authority === 'string') return authority;
      const invitation = await this.directory.invitation(request.invitationId);
      entry.role = invitation?.role;
      if (invitation?.organizationId !== request.organizationId || !authority.some((role) => role === invitation.role)) return 'denied';
      if (invitation.state !== 'pending') return 'not-pending';
      const { invitationId } = invitation;
      return async () => explicitResult(await (change === 'resend' ? this.directory.resendInvitation(invitationId) : this.directory.revokeInvitation(invitationId)), UPDATE_RESULTS);
    });
  }

  // The customer roles that the actor can change in the organization now, from a current read of its own active
  // membership there. The organization comes from the request; a selected organization of a session authorizes
  // nothing. Each administration operation needs completed MFA.
  private async authorityOf(actor: Actor, organizationId: string): Promise<readonly AssignableRole[] | AdministrationRefusal> {
    if (actor.mfaCompleted !== true) return 'mfa-required';
    const memberships = await this.directory.membershipsOf(actor.user);
    const membership = memberships.find((candidate) => candidate.organizationId === organizationId && candidate.active);
    const permissions = new Set(membership?.grants.flatMap((grant) => grant.permissions));
    const roles = ASSIGNABLE_ROLES.filter((role) => permissions.has(MANAGING_PERMISSION[role]));
    return roles.length === 0 ? 'denied' : roles;
  }

  // Runs the checks of a change with current reads, then its one directory change, and keeps a record of the outcome.
  // A failure in the checks changed nothing ('failed'); a failure in the directory change leaves its effect unknown
  // ('unknown'). The service never repeats a directory change by itself.
  private async recordedChange(entry: ChangeEntry, check: () => Promise<ChangeResult | DirectoryChange>): Promise<ChangeResult> {
    const checked = await this.recordingFailure(entry, 'failed', check);
    const outcome = typeof checked === 'string' ? checked : await this.recordingFailure(entry, 'unknown', checked);
    this.keepRecord(entry, outcome);
    return outcome;
  }

  private async recordingFailure<T>(entry: ChangeEntry, outcome: 'failed' | 'unknown', work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (cause) {
      this.keepRecord(entry, outcome);
      throw cause;
    }
  }

  // The record holds only these fields, so that no credential of the session or of an invitation reaches it.
  private keepRecord(entry: ChangeEntry, outcome: ChangeOutcome): void {
    const { actor, organizationId, target, action, role } = entry;
    this.records.record(deepFreeze({
      time: this.clock().toISOString(),
      actor: { authority: actor.user.authority, subject: actor.user.subject },
      organizationId,
      target: { ...target },
      action,
      ...(role === undefined ? {} : { role }),
      outcome,
    }));
  }
}

function isAuthorized(membership: OrganizationMembership): boolean {
  return membership.active && membership.grants.some((grant) => grant.permissions.length > 0);
}

function hasRole(member: OrganizationMember, role: string): boolean {
  return member.grants.some((grant) => grant.role === role);
}

// A seat is an active membership with User. Each membership counts once, also with Admin or Super Admin.
function holdsUserSeat(member: OrganizationMember): boolean {
  return member.status === 'active' && hasRole(member, 'user');
}

// Only an active membership can change, and only in the roles of the authority of the actor.
function memberEntry(member: OrganizationMember, authority: readonly AssignableRole[]): MemberEntry {
  const { membershipId, email, status, revision } = member;
  const roles = [...new Set(member.grants.filter((grant) => grant.permissions.length > 0).map((grant) => grant.role))];
  const changes = status === 'active' ? authority.map((role): MemberChange => ({ role, action: hasRole(member, role) ? 'revoke' : 'grant' })) : [];
  return { membershipId, email, status, roles, revision, changes };
}

// The entry copies only the fields of the contract, so that an invitation token of the provider stays out.
function invitationEntry(invitation: OrganizationInvitation, authority: readonly AssignableRole[]): InvitationEntry {
  const { invitationId, email, role, state } = invitation;
  const changeable = state === 'pending' && authority.some((manageable) => manageable === role);
  return { invitationId, email, role, state, changes: changeable ? ['resend', 'revoke'] : [] };
}

// Only an explicit result of the directory counts. Another answer leaves the effect unknown, so the change fails.
function explicitResult(result: unknown, results: ReadonlyMap<string, ChangeResult>): ChangeResult {
  const outcome = typeof result === 'object' && result !== null && 'outcome' in result ? results.get(String(result.outcome)) : undefined;
  if (outcome === undefined) throw new Error('The directory gave no explicit result for the change');
  return outcome;
}

// Reads each page of a paged read in order. A read that does not end fails, with a repeated cursor or after
// PAGE_LIMIT pages, so that no partial result looks complete.
async function everyPage<T>(read: (cursor: string | undefined) => Promise<Page<T>>): Promise<readonly T[]> {
  const records: T[] = [];
  const cursors = new Set<string>();
  let cursor: string | undefined;
  for (let pages = 0; pages < PAGE_LIMIT; pages += 1) {
    const page = await read(cursor);
    records.push(...page.items);
    if (page.next === undefined) return records;
    if (cursors.has(page.next)) throw new Error('The directory repeated a page cursor');
    cursors.add(page.next);
    cursor = page.next;
  }
  throw new Error(`The directory gave more than ${PAGE_LIMIT} pages`);
}

// Each record once, by its ID. When pages repeat a record, the later page decides, because its read is more recent.
function latestOfEach<T>(records: readonly T[], idOf: (record: T) => string): T[] {
  const latest = new Map<string, T>();
  for (const record of records) latest.set(idOf(record), record);
  return [...latest.values()];
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}
