import type { Organization, WorkOS } from '@workos-inc/node';
import { fixtureNamePrefix, type FixtureRegistry } from './fixture-registry.ts';
import { OperatorRunbook, type OrganizationRequest } from './operator-runbook.ts';
import { FixtureFactory, settled, type LiveUser, type StagingFixtures } from './staging-fixtures.ts';

// The operator of the live proofs. A record names the operator, never a credential.
export const operatorActor = 'operator:hosted-live-gate';

const userLabels = [
  'selector', 'inactive-only', 'new-super-admin', 'independent', 'member-only', 'concurrent-grant', 'concurrent-revoke', 'sole-super-admin',
  'outgoing', 'incoming', 'lost', 'recovering', 'unknown-outcome', 'inactive-retry', 'hosted-super-admin',
] as const;

type OrganizationUserLabel = (typeof userLabels)[number];

export interface OrganizationFixtures {
  readonly runbook: OperatorRunbook;
  readonly organizationRequest: OrganizationRequest;
  // The organization that the first runbook step made for this run.
  readonly operatorOrganization: Organization;
  readonly users: Readonly<Record<OrganizationUserLabel, LiveUser>>;
}

// The data of the AUTH-07W proofs and cases, after the staging fixtures of the run, with the same run ID. Each user
// is new, so that no AUTH-06 proof changes it:
// - selector: User and Admin in A, User in B, and an inactive membership in the operator organization;
// - inactive-only: only an inactive membership in A;
// - independent: User and Admin in the operator organization, and User in B;
// - member-only: a membership in the operator organization made without a role, so that it has the default role;
// - concurrent-grant: User and Admin in the operator organization;
// - concurrent-revoke and sole-super-admin: only Super Admin in the operator organization;
// - outgoing: Super Admin and User in the operator organization;
// - lost: an inactive Super Admin membership in the operator organization;
// - inactive-retry: an inactive User membership in the operator organization;
// - new-super-admin, incoming, recovering, unknown-outcome, and hosted-super-admin: no membership.
export async function createOrganizationFixtures(workos: WorkOS, registry: FixtureRegistry, staging: StagingFixtures): Promise<OrganizationFixtures> {
  const make = new FixtureFactory(workos, registry, staging.runId);
  const runbook = new OperatorRunbook(workos, operatorActor);
  const organizationRequest = { externalId: `thermus-live-${staging.runId}-operator`, name: `${fixtureNamePrefix}${staging.runId} operator` };
  const operatorOrganization = await runbook.organization(organizationRequest);
  registry.record('organization', operatorOrganization.id);
  const created = await settled(userLabels.map((label) => make.user(label)));
  const users = Object.fromEntries(userLabels.map((label, index) => [label, created[index]])) as Record<OrganizationUserLabel, LiveUser>;
  const { organizationA, organizationB } = staging;
  await settled([
    make.membership(users.selector, organizationA, ['user', 'admin']),
    make.membership(users.selector, organizationB, ['user']),
    make.deactivatedMembership(users.selector, operatorOrganization),
    make.deactivatedMembership(users['inactive-only'], organizationA),
    make.membership(users.independent, operatorOrganization, ['user', 'admin']),
    make.membership(users.independent, organizationB, ['user']),
    make.membership(users['member-only'], operatorOrganization, []),
    make.membership(users['concurrent-grant'], operatorOrganization, ['user', 'admin']),
    make.membership(users['concurrent-revoke'], operatorOrganization, ['super-admin']),
    make.membership(users['sole-super-admin'], operatorOrganization, ['super-admin']),
    make.membership(users.outgoing, operatorOrganization, ['super-admin', 'user']),
    make.deactivatedMembership(users.lost, operatorOrganization, ['super-admin']),
    make.deactivatedMembership(users['inactive-retry'], operatorOrganization),
  ]);
  return { runbook, organizationRequest, operatorOrganization, users };
}
