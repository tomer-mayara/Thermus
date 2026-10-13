import type { AuthenticatedUser } from '../../../../src/auth/access-context.ts';
import type { AuthorizedOrganization, OrganizationAdministration } from '../../../../src/organizations/organization-administration.ts';

export type ConfiguredOrganizations = readonly AuthorizedOrganization[] | Error;

export interface SelectionCheck {
  readonly user: AuthenticatedUser;
  readonly organizationId: string;
}

// Gives the configured authorized organizations of each user subject, or fails with a configured error. A selection is
// authorized only for a configured organization of that user.
export class OrganizationAdministrationDouble implements Pick<OrganizationAdministration, 'listOrganizations' | 'authorizeSelection'> {
  readonly lists: AuthenticatedUser[] = [];
  readonly selections: SelectionCheck[] = [];
  private readonly organizations: ReadonlyMap<string, ConfiguredOrganizations>;

  constructor(organizations: ReadonlyMap<string, ConfiguredOrganizations> = new Map()) {
    this.organizations = organizations;
  }

  async listOrganizations(user: AuthenticatedUser): Promise<readonly AuthorizedOrganization[]> {
    this.lists.push(user);
    return this.configuredFor(user);
  }

  async authorizeSelection(user: AuthenticatedUser, organizationId: string): Promise<AuthorizedOrganization | undefined> {
    this.selections.push({ user, organizationId });
    return this.configuredFor(user).find((organization) => organization.organizationId === organizationId);
  }

  private configuredFor(user: AuthenticatedUser): readonly AuthorizedOrganization[] {
    const configured = this.organizations.get(user.subject) ?? [];
    if (configured instanceof Error) throw configured;
    return configured;
  }
}
