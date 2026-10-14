import { randomBytes } from 'node:crypto';
import type { WorkOS } from '@workos-inc/node';
import { fixtureEmailPrefix, fixtureNamePrefix, type FixtureRegistry } from './fixture-registry.ts';
import { connectRedirectUri } from './settings.ts';
import { TotpAuthenticator } from './totp.ts';

export interface LiveOrganization {
  readonly id: string;
  readonly name: string;
}

export interface LiveUser {
  readonly id: string;
  readonly email: string;
  readonly password: string;
  readonly authenticator: TotpAuthenticator;
}

export interface LiveApplication {
  readonly id: string;
  readonly clientId: string;
}

export interface MachineApplication extends LiveApplication {
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

export type MembershipName = 'userAndAdminInA' | 'userInB' | 'connectUserInA' | 'adminOnlyInA' | 'defaultRoleInA' | 'deactivatedUserInA' | 'mixedAdminInA' | 'mixedUserInB';

async function settled<T>(work: readonly Promise<T>[]): Promise<T[]> {
  // Wait for each creation, so that the registry knows every fixture before a failure ends the setup.
  const results = await Promise.allSettled(work);
  const failure = results.find((result) => result.status === 'rejected');
  if (failure) throw failure.reason;
  return results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
}

class FixtureFactory {
  readonly #workos: WorkOS;
  readonly #registry: FixtureRegistry;
  readonly runId = `${Date.now().toString(36)}${randomBytes(3).toString('hex')}`;

  constructor(workos: WorkOS, registry: FixtureRegistry) {
    this.#workos = workos;
    this.#registry = registry;
  }

  async organization(label: string): Promise<LiveOrganization> {
    const name = `${fixtureNamePrefix}${this.runId} ${label}`;
    const { id } = await this.#workos.organizations.createOrganization({ name });
    this.#registry.record('organization', id);
    return { id, name };
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

  async deactivatedMembership(user: LiveUser, organization: LiveOrganization): Promise<string> {
    const id = await this.membership(user, organization, ['user']);
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
