import type { AssignableRole, InvitationIdentityPolicy, InvitationState, MembershipStatus, OrganizationDirectory } from './organization-directory.ts';
interface MemberEntry {
    readonly membershipId: string;
    readonly subject: string;
    readonly email: string;
    readonly status: MembershipStatus;
    readonly roles: readonly string[];
    readonly revision: string;
    readonly removable: boolean;
}
export interface MemberOverview {
    readonly organizationId: string;
    readonly organizationName: string;
    readonly members: readonly MemberEntry[];
    readonly activeUserSeats: number;
}
export type InvitationChange = 'resend' | 'revoke';
export interface InvitationEntry {
    readonly invitationId: string;
    readonly email: string;
    readonly role: string;
    readonly state: InvitationState;
    readonly expiresAt: string;
    readonly changes: readonly InvitationChange[];
}
export interface InvitationOverview {
    readonly organizationId: string;
    readonly invitations: readonly InvitationEntry[];
    readonly invitableRoles: readonly AssignableRole[];
    readonly identityPolicy: InvitationIdentityPolicy;
}
export declare function readMemberOverview(directory: OrganizationDirectory, organizationId: string, organizationName: string): Promise<MemberOverview>;
export declare function activeUserSeatCount(directory: OrganizationDirectory, organizationId: string): Promise<number>;
export declare function readInvitationOverview(directory: OrganizationDirectory, organizationId: string, managed: readonly AssignableRole[]): Promise<InvitationOverview>;
export {};
