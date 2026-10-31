import type { Organization, WorkOS } from '@workos-inc/node';
import { fixtureNamePrefix, type FixtureRegistry } from './fixture-registry.ts';
import { OperatorRunbook, type OrganizationRequest } from './operator-runbook.ts';
import { FixtureFactory, settled, type LiveUser, type StagingFixtures } from './staging-fixtures.ts';

export const operatorActor = 'operator:hosted-live-gate';

const userLabels = [
  'selector', 'inactive-only', 'new-admin', 'independent', 'sole-admin',
  'outgoing', 'incoming', 'lost', 'recovering', 'hosted-admin',
] as const;

type OrganizationUserLabel = (typeof userLabels)[number];

export interface OrganizationFixtures {
  readonly runbook: OperatorRunbook;
  readonly organizationRequest: OrganizationRequest;
  readonly operatorOrganization: Organization;
  readonly users: Readonly<Record<OrganizationUserLabel, LiveUser>>;
}

// Each user is new, so that no AUTH-06 proof changes it.
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
