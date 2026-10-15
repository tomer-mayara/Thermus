import { randomBytes } from 'node:crypto';
import type { WorkOS } from '@workos-inc/node';
import { fixtureEmailPrefix, fixtureNamePrefix, type FixtureRegistry } from './fixture-registry.ts';
import { connectRedirectUri } from './settings.ts';
import { TotpAuthenticator } from './totp.ts';

export interface LiveOrganization {
  readonly id: string;
  readonly name: string;
  // The external ID that WorkOS keeps for the organization, or null without one. WorkOS names the authorization
  // resource of an organization by its external ID, and by its organization ID only when it has none.
  readonly externalId: string | null;
}

export interface LiveUser {
  readonly id: string;
  readonly email: string;
  readonly password: string;
  readonly authenticator: TotpAuthenticator;
}

interface LiveApplication {
  readonly id: string;
  readonly clientId: string;
}

interface MachineApplication extends LiveApplication {
  readonly clientSecret: string;
}

export interface StagingFixtures {
  readonly runId: string;
  readonly organizationA: LiveOrganization;
  readonly organizationB: LiveOrganization;
  readonly clientOwner: LiveOrganization;
  readonly newUser: LiveUser;
  readonly twoOrganizationUser: LiveUser;
  readonly connectUser: LiveUser;
  readonly adminOnlyUser: LiveUser;
  readonly defaultRoleUser: LiveUser;
  readonly mixedUser: LiveUser;
  readonly memberships: Readonly<Record<MembershipName, string>>;
  readonly oauthApplication: LiveApplication;
  readonly machineApplication: MachineApplication;
}

type MembershipName = 'userAndAdminInA' | 'userInB' | 'connectUserInA' | 'adminOnlyInA' | 'defaultRoleInA' | 'deactivatedUserInA' | 'mixedAdminInA' | 'mixedUserInB';

export async function settled<T>(work: readonly Promise<T>[]): Promise<T[]> {
  // Wait for each creation, so that the registry knows every fixture before a failure ends the setup.
  const results = await Promise.allSettled(work);
  const failure = results.find((result) => result.status === 'rejected');
  if (failure) throw failure.reason;
  return results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
}

export class FixtureFactory {
  readonly #workos: WorkOS;
  readonly #registry: FixtureRegistry;
  readonly runId: string;

  // The fixtures of one run share the run ID, so that their names show the run.
  constructor(workos: WorkOS, registry: FixtureRegistry, runId = `${Date.now().toString(36)}${randomBytes(3).toString('hex')}`) {
    this.#workos = workos;
    this.#registry = registry;
    this.runId = runId;
  }

  // An organization with an external ID is like each customer organization of the operator runbook.
  async organization(label: string, externalId?: string): Promise<LiveOrganization> {
    const name = `${fixtureNamePrefix}${this.runId} ${label}`;
    const created = await this.#workos.organizations.createOrganization({ name, externalId });
    this.#registry.record('organization', created.id);
    return { id: created.id, name, externalId: created.externalId };
  }

  async user(label: string): Promise<LiveUser> {
    const email = `${fixtureEmailPrefix}${this.runId}-${label}@example.net`;
    const password = `Tl-${randomBytes(18).toString('base64url')}-9a`;
    const { id } = await this.#workos.userManagement.createUser({ email, password, emailVerified: true, firstName: 'Thermus', lastName: 'Live' });
    this.#registry.record('user', id);
    return { id, email, password, authenticator: new TotpAuthenticator() };
  }

  async membership(user: LiveUser, organization: LiveOrganization, roleSlugs: string[]): Promise<string> {
    const roles = roleSlugs.length === 0 ? {} : { roleSlugs };
    const { id } = await this.#workos.userManagement.createOrganizationMembership({ organizationId: organization.id, userId: user.id, ...roles });
    return id;
  }

  async deactivatedMembership(user: LiveUser, organization: LiveOrganization, roleSlugs: string[] = ['user']): Promise<string> {
    const id = await this.membership(user, organization, roleSlugs);
    await this.#workos.userManagement.deactivateOrganizationMembership(id);
    return id;
  }

  async oauthApplication(owner: LiveOrganization): Promise<LiveApplication> {
    const { id, clientId } = await this.#workos.connect.createApplication({
      applicationType: 'oauth',
      name: `${fixtureNamePrefix}${this.runId} MCP client`,
      isFirstParty: false,
      organizationId: owner.id,
      usesPkce: true,
      redirectUris: [{ uri: connectRedirectUri, default: true }],
    });
    this.#registry.record('application', id);
    return { id, clientId };
  }

  async machineApplication(owner: LiveOrganization): Promise<MachineApplication> {
    const name = `${fixtureNamePrefix}${this.runId} M2M client`;
    const { id, clientId } = await this.#workos.connect.createApplication({ applicationType: 'm2m', name, organizationId: owner.id });
    this.#registry.record('application', id);
    const { secret } = await this.#workos.connect.createApplicationClientSecret({ id });
    return { id, clientId, clientSecret: secret };
  }
}

// The organizations, users, memberships, and Connect applications of one run. Each name has the run ID.
export async function createStagingFixtures(workos: WorkOS, registry: FixtureRegistry): Promise<StagingFixtures> {
  await registry.deleteStaleFixtures();
  const make = new FixtureFactory(workos, registry);
  const [organizationA, organizationB, clientOwner] = await settled(['A', 'B', 'client owner'].map((label) => make.organization(label)));
  const labels = ['new', 'two-organizations', 'connect', 'admin-only', 'default-role', 'deactivated', 'mixed'];
  const [newUser, twoOrganizationUser, connectUser, adminOnlyUser, defaultRoleUser, deactivated, mixedUser] = await settled(labels.map((label) => make.user(label)));
  const [userAndAdminInA, userInB, connectUserInA, adminOnlyInA, defaultRoleInA, deactivatedUserInA, mixedAdminInA, mixedUserInB] = await settled([
    make.membership(twoOrganizationUser, organizationA, ['user', 'admin']),
    make.membership(twoOrganizationUser, organizationB, ['user']),
    make.membership(connectUser, organizationA, ['user']),
    make.membership(adminOnlyUser, organizationA, ['admin']),
    make.membership(defaultRoleUser, organizationA, []),
    make.deactivatedMembership(deactivated, organizationA),
    make.membership(mixedUser, organizationA, ['admin']),
    make.membership(mixedUser, organizationB, ['user']),
  ]);
  const memberships = { userAndAdminInA, userInB, connectUserInA, adminOnlyInA, defaultRoleInA, deactivatedUserInA, mixedAdminInA, mixedUserInB };
  const oauthApplication = await make.oauthApplication(clientOwner);
  const machineApplication = await make.machineApplication(clientOwner);
  return {
    runId: make.runId, organizationA, organizationB, clientOwner, newUser, twoOrganizationUser, connectUser, adminOnlyUser, defaultRoleUser, mixedUser,
    memberships, oauthApplication, machineApplication,
  };
}
