import { invitationsOf, membersOf } from './directory-reads.ts';
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
  readonly email: string;
  readonly status: MembershipStatus;
  // The roles of the grants that give an application permission.
  readonly roles: readonly string[];
  readonly revision: string;
}

export interface MemberOverview {
  readonly organizationId: string;
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
  // The changes that the actor can make now.
  readonly changes: readonly InvitationChange[];
}

export interface InvitationOverview {
  readonly organizationId: string;
  readonly invitations: readonly InvitationEntry[];
  readonly invitableRoles: readonly AssignableRole[];
  readonly identityPolicy: InvitationIdentityPolicy;
}

const INVITATION_STATES: readonly InvitationState[] = Object.freeze(['pending', 'accepted', 'revoked', 'expired']);

export async function readMemberOverview(directory: OrganizationDirectory, organizationId: string): Promise<MemberOverview> {
  const members = await membersOf(directory, organizationId);
  const entries = members.map(memberEntry);
  return Object.freeze({ organizationId, members: Object.freeze(entries), activeUserSeats: userSeatsOf(members) });
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
  return members.filter(holdsUserSeat).length;
}

// Count each active membership with product access once, including an Admin-only membership.
function holdsUserSeat(member: OrganizationMember): boolean {
  return member.status === 'active' && member.grants.some((grant) => grant.permissions.includes('product:access'));
}

function memberEntry(member: OrganizationMember): MemberEntry {
  const { membershipId, email, status, revision } = member;
  const roles = [...new Set(member.grants.filter((grant) => grant.permissions.length > 0).map((grant) => grant.role))];
  return Object.freeze({ membershipId, email, status, roles: Object.freeze(roles), revision });
}

// The entry copies only the fields of the contract, so that an invitation token of the provider stays out.
function invitationEntry(invitation: OrganizationInvitation, managed: readonly AssignableRole[]): InvitationEntry {
  const { invitationId, email, role, state } = invitation;
  const changeable = state === 'pending' && managed.some((managedRole) => managedRole === role);
  return Object.freeze({ invitationId, email, role, state, changes: Object.freeze<InvitationChange[]>(changeable ? ['resend', 'revoke'] : []) });
}
