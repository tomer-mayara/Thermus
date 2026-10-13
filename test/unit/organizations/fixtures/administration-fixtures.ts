import assert from 'node:assert/strict';
import type { RoleGrant } from '../../../../src/auth/access-context.ts';
import type { ChangeRecord } from '../../../../src/organizations/change-records.ts';
import {
  OrganizationAdministration,
  type Actor,
  type GrantChangeRequest,
} from '../../../../src/organizations/organization-administration.ts';
import { BillingDouble } from './billing-double.ts';
import { memberRole, membershipIdOf, type MemberSeed } from './directory-double-records.ts';
import { OrganizationDirectoryDouble } from './organization-directory-double.ts';

export const authority = 'hosted-provider-double';
export const userGrant: RoleGrant = { role: 'user', permissions: ['product:access'] };
export const adminGrant: RoleGrant = { role: 'admin', permissions: ['user-grants:manage'] };
export const superAdminGrant: RoleGrant = { role: 'super-admin', permissions: ['admin-grants:manage', 'billing:manage'] };
export const recordTime = '2026-10-13T12:00:00.000Z';

// Acme (org-a) and Globex (org-b). Acme has 3 active memberships with User: otto, cy, and una.
export const members: readonly MemberSeed[] = [
  { subject: 'user-sam', organizationId: 'org-a', grants: [superAdminGrant] },
  { subject: 'user-otto', organizationId: 'org-a', grants: [userGrant, adminGrant, superAdminGrant] },
  { subject: 'user-cy', organizationId: 'org-a', grants: [userGrant, adminGrant] },
  { subject: 'user-cy', organizationId: 'org-b', grants: [userGrant] },
  { subject: 'user-eve', organizationId: 'org-a', grants: [adminGrant] },
  { subject: 'user-una', organizationId: 'org-a', grants: [userGrant] },
  { subject: 'user-una', organizationId: 'org-b', grants: [userGrant] },
  { subject: 'user-ben', organizationId: 'org-b', grants: [userGrant, adminGrant] },
  { subject: 'user-ivy', organizationId: 'org-a', grants: [userGrant, adminGrant], status: 'inactive' },
  { subject: 'user-pia', organizationId: 'org-a', grants: [userGrant], status: 'pending' },
  { subject: 'user-dora', organizationId: 'org-a', grants: [memberRole] },
];

export function administrationWith(seeds: readonly MemberSeed[] = members) {
  const directory = new OrganizationDirectoryDouble();
  directory.addMembers(...seeds);
  const records: ChangeRecord[] = [];
  const billing = new BillingDouble();
  const administration = new OrganizationAdministration({ directory, records: { record: (entry) => records.push(entry) }, billing, clock: () => new Date(recordTime) });
  return { directory, records, billing, administration };
}

// Acme has a pending, an accepted, a revoked, and an expired User invitation (invitation-1 to -4) and a pending
// Admin invitation (invitation-5); Globex has a pending User invitation (invitation-6).
export function invitationsWith() {
  const served = administrationWith();
  served.directory.addInvitations(
    { organizationId: 'org-a', email: 'pending.user@example.com', role: 'user' },
    { organizationId: 'org-a', email: 'accepted.user@example.com', role: 'user', state: 'accepted' },
    { organizationId: 'org-a', email: 'revoked.user@example.com', role: 'user', state: 'revoked' },
    { organizationId: 'org-a', email: 'expired.user@example.com', role: 'user', state: 'expired' },
    { organizationId: 'org-a', email: 'pending.admin@example.com', role: 'admin' },
    { organizationId: 'org-b', email: 'globex.user@example.com', role: 'user' },
  );
  return served;
}

// The selected organization of the session is Globex, so that a test shows that the service uses only the organization
// of the request.
export function actorOf(subject: string, mfaCompleted = true): Actor {
  return { user: { authority, subject, selectedOrganizationId: 'org-b' }, mfaCompleted };
}

export interface RequestedGrantChange {
  readonly target: string;
  readonly role: string;
  readonly action: string;
  readonly organizationId?: string;
  readonly targetOrganizationId?: string;
}

// A change of the membership of the target with its current revision, as a form shown now would send it.
export function changeOf(directory: OrganizationDirectoryDouble, change: RequestedGrantChange): GrantChangeRequest {
  const organizationId = change.organizationId ?? 'org-a';
  const targetOrganizationId = change.targetOrganizationId ?? organizationId;
  const target = directory.membershipIn(change.target, targetOrganizationId);
  return {
    organizationId,
    membershipId: target?.membershipId ?? membershipIdOf(change.target, targetOrganizationId),
    role: change.role,
    action: change.action,
    revision: target?.revision ?? 'r1',
  };
}

export function rolesIn(directory: OrganizationDirectoryDouble, subject: string, organizationId = 'org-a'): readonly string[] {
  return directory.membershipIn(subject, organizationId)?.grants.map(({ role }) => role) ?? [];
}

// Each record as one line: "<actor> in <organization>: <action> <role> for <target>: <outcome>". Each record must be
// frozen, have the time of the clock and the actor of the provider double, and no field other than those of the
// contract.
export function recordLines(records: readonly ChangeRecord[]): readonly string[] {
  return records.map((record) => {
    assert.ok(Object.isFrozen(record));
    assert.equal(record.time, recordTime);
    assert.deepEqual(Object.keys(record).filter((field) => field !== 'role').sort(), ['action', 'actor', 'organizationId', 'outcome', 'target', 'time']);
    assert.deepEqual(record.actor, { authority, subject: record.actor.subject });
    return `${record.actor.subject} in ${record.organizationId}: ${record.action} ${record.role ?? '-'} for ${Object.values(record.target).join()}: ${record.outcome}`;
  });
}
