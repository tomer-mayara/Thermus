import type { WorkOS } from '@workos-inc/node';
import type { FixtureRegistry } from './fixture-registry.ts';
import { FixtureFactory, settled, type LiveOrganization, type LiveUser, type StagingFixtures } from './staging-fixtures.ts';

// Each label starts with the organization of its proof or case, so that it differs from the labels of the other
// fixtures of the run.
const userLabels = [
  'd-repeat', 'd-concurrent', 'd-absent', 'd-retry', 'd-last-role', 'd-inactive', 'd-pending', 'd-seat-user-admin', 'd-seat-admin',
  'd-seat-super-admin', 'd-seat-default', 'd-seat-inactive', 'd-seat-pending', 'd-invitee', 'd-member',
  'c-super-admin', 'c-admin-only', 'c-administrator', 'c-selective', 'c-last-user', 'c-target', 'c-inactive', 'c-invitee-user',
  'c-invitee-admin', 'c-invitee-revoked',
] as const;

export type AdministrationUserLabel = (typeof userLabels)[number];

interface MembershipSetting {
  readonly make: FixtureFactory;
  readonly workos: WorkOS;
  readonly users: Readonly<Record<AdministrationUserLabel, LiveUser>>;
  readonly organizationB: LiveOrganization;
  readonly organizationC: LiveOrganization;
  readonly organizationD: LiveOrganization;
}

export type AdministrationMembershipName = keyof ReturnType<typeof membershipsToMake>;

export interface AdministrationFixtures {
  // The organization of the AUTH-08W cases of the hosted server.
  readonly organizationC: LiveOrganization;
  // The organization of the AUTH-08W provider proofs.
  readonly organizationD: LiveOrganization;
  readonly users: Readonly<Record<AdministrationUserLabel, LiveUser>>;
  // The ID of each membership that the fixtures made.
  readonly memberships: Readonly<Record<AdministrationMembershipName, string>>;
}

// A WorkOS invitation makes a pending membership with only the invited role, here User.
async function invitedMembership(workos: WorkOS, user: LiveUser, organization: LiveOrganization): Promise<string> {
  await workos.userManagement.sendInvitation({ email: user.email, organizationId: organization.id, roleSlug: 'user' });
  const { data } = await workos.userManagement.listOrganizationMemberships({ userId: user.id, organizationId: organization.id, statuses: ['pending'], limit: 10 });
  const [membership] = data;
  if (data.length !== 1 || membership === undefined) throw new Error(`The invitation made ${data.length} pending memberships, not one.`);
  return membership.id;
}

function membershipsToMake({ make, workos, users, organizationB, organizationC, organizationD }: MembershipSetting) {
  const inD = (label: AdministrationUserLabel, roles: string[]) => () => make.membership(users[label], organizationD, roles);
  const inC = (label: AdministrationUserLabel, roles: string[]) => () => make.membership(users[label], organizationC, roles);
  return {
    repeatInD: inD('d-repeat', ['user']),
    concurrentInD: inD('d-concurrent', ['user']),
    absentInD: inD('d-absent', ['user']),
    retryInD: inD('d-retry', ['user']),
    lastRoleInD: inD('d-last-role', ['user']),
    lastRoleInB: () => make.membership(users['d-last-role'], organizationB, ['user']),
    inactiveInD: () => make.deactivatedMembership(users['d-inactive'], organizationD),
    pendingInD: () => invitedMembership(workos, users['d-pending'], organizationD),
    seatUserAdminInD: inD('d-seat-user-admin', ['user', 'admin']),
    seatAdminInD: inD('d-seat-admin', ['admin']),
    seatSuperAdminInD: inD('d-seat-super-admin', ['super-admin']),
    seatDefaultInD: inD('d-seat-default', []),
    seatInactiveInD: () => make.deactivatedMembership(users['d-seat-inactive'], organizationD),
    seatPendingInD: () => invitedMembership(workos, users['d-seat-pending'], organizationD),
    memberInD: inD('d-member', ['user']),
    superAdminInC: inC('c-super-admin', ['super-admin']),
    adminOnlyInC: inC('c-admin-only', ['admin']),
    administratorInC: inC('c-administrator', ['super-admin', 'admin']),
    selectiveInC: inC('c-selective', ['user', 'admin']),
    lastUserInC: inC('c-last-user', ['user']),
    lastUserInB: () => make.membership(users['c-last-user'], organizationB, ['user']),
    targetInC: inC('c-target', ['user']),
    inactiveInC: () => make.deactivatedMembership(users['c-inactive'], organizationC, ['user', 'admin']),
    inviteeAdminInC: () => make.deactivatedMembership(users['c-invitee-admin'], organizationC, ['user', 'admin']),
  };
}

// The data of the AUTH-08W proofs and cases, after the staging fixtures of the run, with the same run ID. Each user is
// new, so that no other proof or case changes it. Organization B is the one of the staging fixtures.
// Organization D, of the provider proofs:
// - d-repeat, d-concurrent, d-absent, and d-retry: User;
// - d-last-role: User, and User in B;
// - d-inactive: an inactive membership with User;
// - d-pending: a pending membership with User, from an invitation;
// - d-seat-user-admin: User and Admin; d-seat-admin: Admin; d-seat-super-admin: Super Admin; d-seat-default: only
//   the default role; d-seat-inactive: an inactive membership with User; d-seat-pending: a pending membership with
//   User, from an invitation;
// - d-member: User, the address of an active member;
// - d-invitee: no membership.
// Organization C, of the server cases:
// - c-super-admin: only Super Admin; c-admin-only: only Admin;
// - c-administrator: Super Admin and Admin, the administrator of the later cases;
// - c-selective: User and Admin;
// - c-last-user: User, and User in B;
// - c-target: User; c-inactive: an inactive membership with User and Admin;
// - c-invitee-admin: an inactive membership with User and Admin;
// - c-invitee-user and c-invitee-revoked: no membership.
export async function createAdministrationFixtures(workos: WorkOS, registry: FixtureRegistry, staging: StagingFixtures): Promise<AdministrationFixtures> {
  const make = new FixtureFactory(workos, registry, staging.runId);
  const [organizationC, organizationD] = await settled(['C', 'D'].map((label) => make.organization(label)));
  const created = await settled(userLabels.map((label) => make.user(label)));
  const users = Object.fromEntries(userLabels.map((label, index) => [label, created[index]])) as Record<AdministrationUserLabel, LiveUser>;
  const toMake = membershipsToMake({ make, workos, users, organizationB: staging.organizationB, organizationC, organizationD });
  const names = Object.keys(toMake) as AdministrationMembershipName[];
  const ids = await settled(names.map((name) => toMake[name]()));
  const memberships = Object.fromEntries(names.map((name, index) => [name, ids[index]])) as Record<AdministrationMembershipName, string>;
  return { organizationC, organizationD, users, memberships };
}
