import type { AuthenticatedUser, RoleGrant } from '../../../src/accounts/identity/access-context.ts';
import type { MembershipRecord } from '../doubles/organizations/membership-directory-double.ts';
import { adminGrant, memberRole, userGrant } from './hosted-roles.ts';

export const authority = 'hosted-provider-double';
const organizationNames: Readonly<Record<string, string>> = { 'org-a': 'Acme', 'org-b': 'Globex', 'org-c': 'Initech', 'org-d': 'Umbrella', 'org-e': 'Hooli' };

export function userOf(subject: string, selectedOrganizationId?: string): AuthenticatedUser {
  return { authority, subject, ...(selectedOrganizationId === undefined ? {} : { selectedOrganizationId }) };
}

export function member(subject: string, organizationId: string, grants: readonly RoleGrant[]): MembershipRecord {
  return { subject, organizationId, organizationName: organizationNames[organizationId] ?? organizationId, active: true, grants };
}

export const members: readonly MembershipRecord[] = [
  { ...member('user-ivy', 'org-a', [userGrant, adminGrant]), active: false },
  member('user-dora', 'org-a', [memberRole]),
  member('user-mia', 'org-a', [userGrant]),
  member('user-mia', 'org-b', [adminGrant]),
  { ...member('user-mia', 'org-c', [userGrant, adminGrant]), active: false },
  member('user-otto', 'org-d', [userGrant, adminGrant]),
  member('user-sam', 'org-a', [adminGrant]),
  member('user-una', 'org-a', [userGrant]),
];

// Acme (org-a) has 6 active product members: sam, otto, cy, fay, eve, and una. Inactive ivy and pending pia do not
// count. Globex (org-b) has 3: cy, una, and ben.
export const administrationMembers: readonly MembershipRecord[] = [
  member('user-sam', 'org-a', [adminGrant]),
  member('user-otto', 'org-a', [userGrant, adminGrant]),
  member('user-cy', 'org-a', [userGrant, adminGrant]),
  member('user-cy', 'org-b', [userGrant]),
  member('user-fay', 'org-a', [userGrant, adminGrant]),
  member('user-eve', 'org-a', [adminGrant]),
  member('user-una', 'org-a', [userGrant]),
  member('user-una', 'org-b', [userGrant]),
  member('user-ben', 'org-b', [userGrant, adminGrant]),
  { ...member('user-ivy', 'org-a', [userGrant]), active: false },
  member('user-dora', 'org-a', [memberRole]),
  { ...member('user-pia', 'org-a', [userGrant]), active: false, status: 'pending' },
];
