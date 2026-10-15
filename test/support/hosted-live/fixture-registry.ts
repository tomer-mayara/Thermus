import type { WorkOS } from '@workos-inc/node';
import { statusOf } from './sdk-errors.ts';

export type FixtureKind = 'application' | 'user' | 'organization';

export const fixtureEmailPrefix = 'thermus-live-';
export const fixtureNamePrefix = 'Thermus live ';

// An application belongs to an organization, and a membership joins a user to an organization: delete in this order.
const deletionOrder: readonly FixtureKind[] = ['application', 'user', 'organization'];

function failureText(error: unknown): string {
  const status = statusOf(error);
  const name = error instanceof Error ? error.name : 'Error';
  return status === undefined ? name : `${name} HTTP ${String(status)}`;
}

async function deleteFixture(workos: WorkOS, kind: FixtureKind, id: string): Promise<void> {
  const deletions: Record<FixtureKind, () => Promise<void>> = {
    application: () => workos.connect.deleteApplication({ id }),
    user: () => workos.userManagement.deleteUser(id),
    organization: () => workos.organizations.deleteOrganization(id),
  };
  try {
    await deletions[kind]();
  } catch (error) {
    if (statusOf(error) !== 404) throw error;
  }
}

async function staleFixtures(workos: WorkOS): Promise<Record<FixtureKind, string[]>> {
  const applications = await (await workos.connect.listApplications()).autoPagination();
  const users = await (await workos.userManagement.listUsers()).autoPagination();
  const organizations = await (await workos.organizations.listOrganizations()).autoPagination();
  return {
    application: applications.filter(({ name }) => name.startsWith(fixtureNamePrefix)).map(({ id }) => id),
    user: users.filter(({ email }) => email.startsWith(fixtureEmailPrefix)).map(({ id }) => id),
    organization: organizations.filter(({ name }) => name.startsWith(fixtureNamePrefix)).map(({ id }) => id),
  };
}

// The staging data of one live run. Only one run may use the staging environment at a time.
export class FixtureRegistry {
  readonly #workos: WorkOS;
  readonly #created: Record<FixtureKind, string[]> = { application: [], user: [], organization: [] };

  constructor(workos: WorkOS) {
    this.#workos = workos;
  }

  record(kind: FixtureKind, id: string): void {
    this.#created[kind].push(id);
  }

  // A crashed run can leave its fixtures. The fixtures of this run must start from a clean environment.
  async deleteStaleFixtures(): Promise<void> {
    const stale = await staleFixtures(this.#workos);
    for (const kind of deletionOrder) {
      for (const id of stale[kind]) await deleteFixture(this.#workos, kind, id);
    }
  }

  async deleteAll(): Promise<void> {
    const failures: string[] = [];
    for (const kind of deletionOrder) {
      const ids = this.#created[kind].splice(0);
      for (const id of ids) await deleteFixture(this.#workos, kind, id).catch((error: unknown) => failures.push(`${kind} ${id}: ${failureText(error)}`));
    }
    if (failures.length > 0) throw new Error(`The hosted live run could not delete these staging fixtures:\n${failures.join('\n')}`);
  }
}
