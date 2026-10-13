import { hasRole, type RoleChange } from './customer-roles.ts';
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

export interface MemberEntry {
  readonly membershipId: string;
  readonly email: string;
  readonly status: MembershipStatus;
  // The roles of the grants that give an application permission.
  readonly roles: readonly string[];
  readonly revision: string;
  // The changes that the actor can make now.
  readonly changes: readonly RoleChange[];
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

const INVITATION_STATES: readonly InvitationState[] = Object.freeze(['pending', 'accepted', 'revoked', 'expired']);

// The members of the organization, each with the changes of the managed roles, and the active User seats.
export async function readMemberOverview(directory: OrganizationDirectory, organizationId: string, managed: readonly AssignableRole[]): Promise<MemberOverview> {
  const members = await membersOf(directory, organizationId);
  const entries = members.map((member) => memberEntry(member, managed));
  return Object.freeze({ organizationId, members: Object.freeze(entries), activeUserSeats: members.filter(holdsUserSeat).length });
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

// A seat is an active membership with User. Each membership counts once, also with Admin or Super Admin.
function holdsUserSeat(member: OrganizationMember): boolean {
  return member.status === 'active' && hasRole(member.grants, 'user');
}

// Only an active membership can change, and only in the managed roles.
function memberEntry(member: OrganizationMember, managed: readonly AssignableRole[]): MemberEntry {
  const { membershipId, email, status, revision } = member;
  const roles = [...new Set(member.grants.filter((grant) => grant.permissions.length > 0).map((grant) => grant.role))];
  const changes = status === 'active' ? managed.map((role) => Object.freeze<RoleChange>({ role, action: hasRole(member.grants, role) ? 'revoke' : 'grant' })) : [];
  return Object.freeze({ membershipId, email, status, roles: Object.freeze(roles), revision, changes: Object.freeze(changes) });
}

// The entry copies only the fields of the contract, so that an invitation token of the provider stays out.
function invitationEntry(invitation: OrganizationInvitation, managed: readonly AssignableRole[]): InvitationEntry {
  const { invitationId, email, role, state } = invitation;
  const changeable = state === 'pending' && managed.some((managedRole) => managedRole === role);
  return Object.freeze({ invitationId, email, role, state, changes: Object.freeze<InvitationChange[]>(changeable ? ['resend', 'revoke'] : []) });
}
