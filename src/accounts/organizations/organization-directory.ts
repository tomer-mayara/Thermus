import type { AuthenticatedUser, RoleGrant } from '../identity/access-context.ts';

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
  // The member's identity subject in this directory's authority. Do not infer it from an email.
  readonly subject: string;
  readonly organizationId: string;
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
  // The provider expiry time in ISO 8601 format.
  readonly expiresAt: string;
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

// The customer roles that an invitation can give. Admin includes product access.
export type AssignableRole = 'user' | 'admin';

export interface InvitationRequest {
  readonly organizationId: string;
  readonly email: string;
  // The invitation assigns this role. Admin includes product access.
  readonly role: AssignableRole;
}

// 'address-in-use': the address already belongs to a member of the organization or has a pending invitation there, so
// the directory sent none. 'unsupported': the directory cannot send the invitation safely, so it sent none.
export interface InvitationSendResult {
  readonly outcome: 'applied' | 'address-in-use' | 'unsupported';
}

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
  invitationPage(request: InvitationPageRequest): Promise<Page<OrganizationInvitation>>;
  // The invitation with this ID in any organization, or undefined.
  invitation(invitationId: string): Promise<OrganizationInvitation | undefined>;
  // The directory sends the invitation and owns its acceptance and the activation of the membership. An acceptance
  // activates only the role of the invitation: a membership that it makes active again keeps no other grant, so that an
  // invitation cannot restore a grant outside the authority of its sender.
  sendInvitation(request: InvitationRequest): Promise<InvitationSendResult>;
  // Each changes only a pending invitation.
  resendInvitation(invitationId: string): Promise<InvitationUpdateResult>;
  revokeInvitation(invitationId: string): Promise<InvitationUpdateResult>;
  readonly invitationIdentityPolicy: InvitationIdentityPolicy;
}
