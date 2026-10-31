import type { WorkOS } from '@workos-inc/node';
import type { FixtureRegistry } from './fixture-registry.ts';
import { FixtureFactory, settled, type LiveOrganization, type LiveUser, type StagingFixtures } from './staging-fixtures.ts';

// Each label starts with the organization of its proof or case, so that it differs from the labels of the other
// fixtures of the run.
const userLabels = [
  'd-seat-user-admin', 'd-seat-admin', 'd-seat-user', 'd-seat-default', 'd-seat-inactive', 'd-seat-pending', 'd-invitee', 'd-member',
  'c-admin-only', 'c-administrator', 'c-target', 'c-invitee-user',
  'c-invitee-admin', 'c-invitee-revoked',
] as const;

type AdministrationUserLabel = (typeof userLabels)[number];

interface MembershipSetting {
  readonly make: FixtureFactory;
  readonly workos: WorkOS;
  readonly users: Readonly<Record<AdministrationUserLabel, LiveUser>>;
  readonly organizationC: LiveOrganization;
  readonly organizationD: LiveOrganization;
}

export type AdministrationMembershipName = keyof ReturnType<typeof membershipsToMake>;

export interface AdministrationFixtures {
  readonly organizationC: LiveOrganization;
  readonly organizationD: LiveOrganization;
  readonly users: Readonly<Record<AdministrationUserLabel, LiveUser>>;
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

function membershipsToMake({ make, workos, users, organizationC, organizationD }: MembershipSetting) {
  const inD = (label: AdministrationUserLabel, roles: string[]) => () => make.membership(users[label], organizationD, roles);
  const inC = (label: AdministrationUserLabel, roles: string[]) => () => make.membership(users[label], organizationC, roles);
  return {
    seatUserAdminInD: inD('d-seat-user-admin', ['user', 'admin']),
    seatAdminInD: inD('d-seat-admin', ['admin']),
    seatUserInD: inD('d-seat-user', ['user']),
    seatDefaultInD: inD('d-seat-default', []),
    seatInactiveInD: () => make.deactivatedMembership(users['d-seat-inactive'], organizationD),
    seatPendingInD: () => invitedMembership(workos, users['d-seat-pending'], organizationD),
    memberInD: inD('d-member', ['user']),
    adminOnlyInC: inC('c-admin-only', ['admin']),
    administratorInC: inC('c-administrator', ['admin']),
    targetInC: inC('c-target', ['user']),
    inviteeAdminInC: () => make.deactivatedMembership(users['c-invitee-admin'], organizationC, ['user', 'admin']),
  };
}

// Each user is new, so that no other proof or case changes it. Organization C has an external ID, as each customer
// organization of the operator runbook has one; organization D has none.
export async function createAdministrationFixtures(workos: WorkOS, registry: FixtureRegistry, staging: StagingFixtures): Promise<AdministrationFixtures> {
  const make = new FixtureFactory(workos, registry, staging.runId);
  const [organizationC, organizationD] = await settled([make.organization('C', `thermus-live-${staging.runId}-c`), make.organization('D')]);
  const created = await settled(userLabels.map((label) => make.user(label)));
  const users = Object.fromEntries(userLabels.map((label, index) => [label, created[index]])) as Record<AdministrationUserLabel, LiveUser>;
  const toMake = membershipsToMake({ make, workos, users, organizationC, organizationD });
  const names = Object.keys(toMake) as AdministrationMembershipName[];
  const ids = await settled(names.map((name) => toMake[name]()));
  const memberships = Object.fromEntries(names.map((name, index) => [name, ids[index]])) as Record<AdministrationMembershipName, string>;
  return { organizationC, organizationD, users, memberships };
}
