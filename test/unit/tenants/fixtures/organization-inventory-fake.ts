import type {
  DefaultRoleMembership, DefaultRoleRead, OrganizationInventory, OrganizationList, OrganizationRead,
} from '../../../../src/tenancy/tenants/organization-inventory.ts';

// A fake (Meszaros) of the organization inventory: the organizations that the identity provider has, the ones that its
// list leaves out while a read by ID still finds them, and the default-role memberships. listFailure, readFailures, and
// membershipFailure stand in for a failed read. calls records each operation in order.
export class OrganizationInventoryFake implements OrganizationInventory {
  readonly calls: string[] = [];
  readonly organizations = new Set<string>();
  readonly unlisted = new Set<string>();
  readonly readFailures = new Map<string, string>();
  readonly defaultRoles: DefaultRoleMembership[] = [];
  listFailure: string | undefined;
  membershipFailure: string | undefined;

  constructor(organizations: readonly string[] = []) {
    for (const organizationId of organizations) this.organizations.add(organizationId);
  }

  async listOrganizations(signal: AbortSignal): Promise<OrganizationList> {
    this.call('list', signal);
    if (this.listFailure !== undefined) return { status: 'unavailable', reason: this.listFailure };
    return { status: 'complete', organizationIds: new Set([...this.organizations].filter((organizationId) => !this.unlisted.has(organizationId))) };
  }

  async readOrganization(organizationId: string, signal: AbortSignal): Promise<OrganizationRead> {
    this.call(`read ${organizationId}`, signal);
    const failure = this.readFailures.get(organizationId);
    if (failure !== undefined) return { status: 'unavailable', reason: failure };
    return { status: this.organizations.has(organizationId) ? 'present' : 'absent' };
  }

  async defaultRoleMemberships(signal: AbortSignal): Promise<DefaultRoleRead> {
    this.call('default roles', signal);
    if (this.membershipFailure !== undefined) return { status: 'unavailable', reason: this.membershipFailure };
    return { status: 'complete', memberships: [...this.defaultRoles] };
  }

  private call(call: string, signal: AbortSignal): void {
    this.calls.push(call);
    signal.throwIfAborted();
  }
}
