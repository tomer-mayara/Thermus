import type { Organization, WorkOS } from '@workos-inc/node';
import { fixtureNamePrefix, type FixtureRegistry } from './fixture-registry.ts';
import { OperatorRunbook, type OrganizationRequest } from './operator-runbook.ts';
import { FixtureFactory, settled, type LiveUser, type StagingFixtures } from './staging-fixtures.ts';

// The operator of the live proofs. A record names the operator, never a credential.
export const operatorActor = 'operator:hosted-live-gate';

const userLabels = [
  'selector', 'inactive-only', 'new-admin', 'independent', 'sole-admin',
  'outgoing', 'incoming', 'lost', 'recovering', 'hosted-admin',
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
// - independent: User in the operator organization, and User in B;
// - sole-admin: only Admin in the operator organization;
// - outgoing: Admin and User in the operator organization;
// - lost: an inactive Admin membership in the operator organization;
// - new-admin, incoming, recovering, and hosted-admin: no membership.
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
    make.membership(users.independent, operatorOrganization, ['user']),
    make.membership(users.independent, organizationB, ['user']),
    make.membership(users['sole-admin'], operatorOrganization, ['admin']),
    make.membership(users.outgoing, operatorOrganization, ['admin', 'user']),
    make.deactivatedMembership(users.lost, operatorOrganization, ['admin']),
  ]);
  return { runbook, organizationRequest, operatorOrganization, users };
}
