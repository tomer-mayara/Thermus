import type { AuthenticatedUser } from '../../../../src/accounts/identity/access-context.ts';
import type {
  InvitationIdentityPolicy,
  InvitationPageRequest,
  InvitationRequest,
  InvitationSendResult,
  InvitationUpdateResult,
  MemberPageRequest,
  MembershipDeletionResult,
  OrganizationDirectory,
  OrganizationInvitation,
  OrganizationMember,
  OrganizationMemberFacts,
  OrganizationMembership,
  Page,
} from '../../../../src/accounts/organizations/organization-directory.ts';
import { ChangeAnswers } from './change-answers.ts';
import { chunks, memberOf, pageAt, roleGrantOf, stateOf, withRole, type InvitationRecord, type InvitationSeed, type MemberSeed, type MemberState, type PageLayout } from './directory-double-records.ts';

type ConfiguredMemberships = readonly OrganizationMembership[] | Error;

export class OrganizationDirectoryDouble extends ChangeAnswers implements OrganizationDirectory {
  readonly membershipReads: AuthenticatedUser[] = [];
  readonly memberPageReads: MemberPageRequest[] = [];
  readonly memberFactsPageReads: MemberPageRequest[] = [];
  readonly memberReads: string[] = [];
  readonly invitationPageReads: InvitationPageRequest[] = [];
  readonly invitationReads: string[] = [];
  readonly invitationChanges: string[] = [];
  invitationIdentityPolicy: InvitationIdentityPolicy = 'invited-address';
  pageSize = 2;
  memberPageLayout?: PageLayout<OrganizationMember>;
  memberFactsPageLayout?: PageLayout<OrganizationMemberFacts>;
  invitationPageLayout?: PageLayout<OrganizationInvitation>;
  // A directory of another authority knows no user of this one.
  authority?: string;
  private members: MemberState[] = [];
  private readonly invitations: InvitationRecord[] = [];
  private readonly membershipFailures = new Map<string, Error>();
  private membershipOutage?: Error;

  constructor(memberships: ReadonlyMap<string, ConfiguredMemberships> = new Map()) {
    super();
    for (const [subject, configured] of memberships) this.configure(subject, configured);
  }

  configure(subject: string, memberships: ConfiguredMemberships): void {
    this.members = this.members.filter((member) => member.subject !== subject);
    this.membershipFailures.delete(subject);
    if (memberships instanceof Error) this.membershipFailures.set(subject, memberships);
    else this.addMembers(...memberships.map((membership): MemberSeed => ({ subject, ...membership, status: membership.active ? 'active' : 'inactive' })));
  }

  addMembers(...seeds: readonly MemberSeed[]): void {
    this.members.push(...seeds.map(stateOf));
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

  membershipIn(subject: string, organizationId: string): OrganizationMember | undefined {
    const state = this.members.find((member) => member.subject === subject && member.organizationId === organizationId);
    return state === undefined ? undefined : memberOf(state);
  }

  invitationTo(email: string): InvitationRecord | undefined {
    const record = this.invitations.findLast((invitation) => invitation.email === email);
    return record === undefined ? undefined : { ...record };
  }

  // The provider owns the acceptance. A membership that it makes active again gets only the role of the invitation.
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
    member.grants = member.status === 'active' ? withRole(member.grants, grant) : [grant];
    member.status = 'active';
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
    const matching = this.members.filter((member) => member.organizationId === request.organizationId && request.statuses.includes(member.status)).map(memberOf);
    return pageAt(this.memberPageLayout?.(matching) ?? chunks(matching, this.pageSize), request.cursor);
  }

  async memberFactsPage(request: MemberPageRequest): Promise<Page<OrganizationMemberFacts>> {
    this.memberFactsPageReads.push(request);
    const matching = this.members.filter(member => member.organizationId === request.organizationId && request.statuses.includes(member.status))
      .map(memberOf).map(({ email: _email, ...facts }) => facts);
    return pageAt(this.memberFactsPageLayout?.(matching) ?? chunks(matching, this.pageSize), request.cursor);
  }

  async member(membershipId: string): Promise<OrganizationMember | undefined> {
    this.memberReads.push(membershipId);
    const state = this.members.find((member) => member.membershipId === membershipId);
    return state === undefined ? undefined : memberOf(state);
  }

  async deleteMembership(membershipId: string): Promise<MembershipDeletionResult> {
    const member = this.members.find((state) => state.membershipId === membershipId);
    if (member === undefined) throw new Error(`No membership ${membershipId}`);
    this.members = this.members.filter((state) => state !== member);
    return { outcome: 'applied' };
  }

  async invitationPage(request: InvitationPageRequest): Promise<Page<OrganizationInvitation>> {
    this.invitationPageReads.push(request);
    const matching = this.invitations.filter((invitation) => invitation.organizationId === request.organizationId && request.states.includes(invitation.state));
    const copies = matching.map((invitation) => ({ ...invitation }));
    return pageAt(this.invitationPageLayout?.(copies) ?? chunks(copies, this.pageSize), request.cursor);
  }

  async invitation(invitationId: string): Promise<OrganizationInvitation | undefined> {
    this.invitationReads.push(invitationId);
    const record = this.invitations.find((invitation) => invitation.invitationId === invitationId);
    return record === undefined ? undefined : { ...record };
  }

  async sendInvitation(request: InvitationRequest): Promise<InvitationSendResult> {
    this.invitationChanges.push(`send ${request.organizationId} ${request.role} ${request.email}`);
    return this.answer('sendInvitation', () => {
      const sameAddress = (record: { readonly organizationId: string; readonly email: string }) => record.organizationId === request.organizationId && record.email.toLowerCase() === request.email.toLowerCase();
      if (this.members.some((member) => member.status === 'active' && sameAddress(member))
        || this.invitations.some((invitation) => invitation.state === 'pending' && sameAddress(invitation))) return { outcome: 'address-in-use' };
      this.invitations.push(this.invitationOf(request));
      return { outcome: 'applied' };
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

  private invitationWithId(invitationId: string): InvitationRecord {
    const invitation = this.invitations.find((record) => record.invitationId === invitationId);
    if (invitation === undefined) throw new Error(`No invitation ${invitationId}`);
    return invitation;
  }

  private invitationOf(seed: InvitationSeed): InvitationRecord {
    const invitationId = seed.invitationId ?? `invitation-${this.invitations.length + 1}`;
    const expiresAt = seed.expiresAt ?? '2099-01-01T00:00:00.000Z';
    return { invitationId, organizationId: seed.organizationId, email: seed.email, role: seed.role, state: seed.state ?? 'pending', expiresAt, token: `${invitationId}-secret-token` };
  }
}
