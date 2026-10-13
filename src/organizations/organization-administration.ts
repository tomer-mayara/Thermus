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

// Customer organization work: the onboarding, listing, and selection of the organizations of the signed-in user. The
// external operator sets up organizations and their Super Admins outside this service, so it has no method for them.
export class OrganizationAdministration {
  private readonly directory: OrganizationDirectory;

  constructor(options: OrganizationAdministrationOptions) {
    this.directory = options.directory;
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
}

function isAuthorized(membership: OrganizationMembership): boolean {
  return membership.active && membership.grants.some((grant) => grant.permissions.length > 0);
}
