import type { AuthenticatedUser, RoleGrant } from '../identity/access-context.ts';
export interface OrganizationMembership {
    readonly organizationId: string;
    readonly organizationName: string;
    readonly active: boolean;
    readonly grants: readonly RoleGrant[];
}
export type MembershipStatus = 'active' | 'inactive' | 'pending';
export type MembershipManagement = 'ordinary' | 'external' | 'unknown';
export interface OrganizationMember {
    readonly membershipId: string;
    readonly subject: string;
    readonly organizationId: string;
    readonly email: string;
    readonly status: MembershipStatus;
    readonly management: MembershipManagement;
    readonly grants: readonly RoleGrant[];
    readonly revision: string;
}
export type InvitationState = 'pending' | 'accepted' | 'revoked' | 'expired';
export interface OrganizationInvitation {
    readonly invitationId: string;
    readonly organizationId: string;
    readonly email: string;
    readonly role: string;
    readonly state: InvitationState;
    readonly expiresAt: string;
}
export type InvitationIdentityPolicy = 'invited-address' | 'provider-rules';
export interface Page<T> {
    readonly items: readonly T[];
    readonly next?: string;
}
export interface MemberPageRequest {
    readonly organizationId: string;
    readonly statuses: readonly MembershipStatus[];
    readonly cursor?: string;
    readonly signal?: AbortSignal;
}
export interface InvitationPageRequest {
    readonly organizationId: string;
    readonly states: readonly InvitationState[];
    readonly cursor?: string;
}
export type AssignableRole = 'user' | 'admin';
export interface InvitationRequest {
    readonly organizationId: string;
    readonly email: string;
    readonly role: AssignableRole;
}
export interface InvitationSendResult {
    readonly outcome: 'applied' | 'address-in-use' | 'unsupported';
}
export interface InvitationUpdateResult {
    readonly outcome: 'applied' | 'not-pending' | 'unsupported';
}
export interface MembershipDeletionResult {
    readonly outcome: 'applied' | 'unsupported';
}
export interface OrganizationDirectory {
    membershipsOf(user: AuthenticatedUser, signal?: AbortSignal): Promise<readonly OrganizationMembership[]>;
    memberPage(request: MemberPageRequest): Promise<Page<OrganizationMember>>;
    member(membershipId: string, signal?: AbortSignal): Promise<OrganizationMember | undefined>;
    deleteMembership(membershipId: string): Promise<MembershipDeletionResult>;
    invitationPage(request: InvitationPageRequest): Promise<Page<OrganizationInvitation>>;
    invitation(invitationId: string): Promise<OrganizationInvitation | undefined>;
    sendInvitation(request: InvitationRequest): Promise<InvitationSendResult>;
    resendInvitation(invitationId: string): Promise<InvitationUpdateResult>;
    revokeInvitation(invitationId: string): Promise<InvitationUpdateResult>;
    readonly invitationIdentityPolicy: InvitationIdentityPolicy;
}
