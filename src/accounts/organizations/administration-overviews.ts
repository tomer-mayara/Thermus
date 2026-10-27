import { invitationsOf, membersOf } from './directory-reads.ts';
import { holdsSeat } from './member-limit.ts';
import { removalSupported } from './membership-removal-checks.ts';
import type {
  AssignableRole,
  InvitationIdentityPolicy,
  InvitationState,
  MembershipStatus,
  OrganizationDirectory,
  OrganizationInvitation,
  OrganizationMember,
} from './organization-directory.ts';

interface MemberEntry {
  readonly membershipId: string;
  readonly subject: string;
  readonly email: string;
  readonly status: MembershipStatus;
  // The roles of the grants that give an application permission.
  readonly roles: readonly string[];
  readonly revision: string;
  // A supported target at read time, not authority to remove it later.
  readonly removable: boolean;
}

export interface MemberOverview {
  readonly organizationId: string;
  readonly organizationName: string;
  readonly members: readonly MemberEntry[];
  // The active memberships with product access, each counted once. The name stays for existing callers.
  readonly activeUserSeats: number;
}

export type InvitationChange = 'resend' | 'revoke';

export interface InvitationEntry {
  readonly invitationId: string;
  readonly email: string;
  readonly role: string;
  readonly state: InvitationState;
  readonly expiresAt: string;
  // The changes that the actor can make now.
  readonly changes: readonly InvitationChange[];
}

// The seats of a plan with a member limit: each active membership with product access and each pending invitation
// holds one. After a downgrade, used can be above the limit.
export interface SeatUsage {
  readonly used: number;
  readonly limit: number;
}

export interface InvitationOverview {
  readonly organizationId: string;
  readonly invitations: readonly InvitationEntry[];
  readonly invitableRoles: readonly AssignableRole[];
  readonly identityPolicy: InvitationIdentityPolicy;
  // Only a plan with a member limit has seats.
  readonly seats?: SeatUsage;
}

const INVITATION_STATES: readonly InvitationState[] = Object.freeze(['pending', 'accepted', 'revoked', 'expired']);

export async function readMemberOverview(directory: OrganizationDirectory, organizationId: string, organizationName: string): Promise<MemberOverview> {
  const members = await membersOf(directory, organizationId);
  const entries = members.map(memberEntry);
  return Object.freeze({ organizationId, organizationName, members: Object.freeze(entries), activeUserSeats: userSeatsOf(members) });
}

// From every member page, so that a failed page fails the count and no partial count looks complete.
export async function activeUserSeatCount(directory: OrganizationDirectory, organizationId: string): Promise<number> {
  return userSeatsOf(await membersOf(directory, organizationId));
}

export async function readInvitationOverview(directory: OrganizationDirectory, organizationId: string, managed: readonly AssignableRole[]): Promise<InvitationOverview> {
  const invitations = await invitationsOf(directory, organizationId, INVITATION_STATES);
  const entries = invitations.map((invitation) => invitationEntry(invitation, managed));
  return Object.freeze({
    organizationId,
    invitations: Object.freeze(entries),
    invitableRoles: Object.freeze([...managed]),
    identityPolicy: directory.invitationIdentityPolicy,
  });
}

function userSeatsOf(members: readonly OrganizationMember[]): number {
  return members.filter(holdsSeat).length;
}

function memberEntry(member: OrganizationMember): MemberEntry {
  const { membershipId, subject, email, status, revision } = member;
  const roles = [...new Set(member.grants.filter((grant) => grant.permissions.length > 0).map((grant) => grant.role))];
  return Object.freeze({ membershipId, subject, email, status, roles: Object.freeze(roles), revision, removable: removalSupported(member) });
}

// The entry copies only the fields of the contract, so that an invitation token of the provider stays out.
function invitationEntry(invitation: OrganizationInvitation, managed: readonly AssignableRole[]): InvitationEntry {
  const { invitationId, email, role, state, expiresAt } = invitation;
  const changeable = state === 'pending' && managed.some((managedRole) => managedRole === role);
  return Object.freeze({ invitationId, email, role, state, expiresAt, changes: Object.freeze<InvitationChange[]>(changeable ? ['resend', 'revoke'] : []) });
}
