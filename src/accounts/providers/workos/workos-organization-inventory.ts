import type { WorkOS } from '@workos-inc/node';
import type {
  DefaultRoleMembership, DefaultRoleRead, OrganizationInventory, OrganizationList, OrganizationRead,
} from '../../../tenancy/tenants/organization-inventory.ts';
import { isMappedRole } from './hosted-role-mapping.ts';
import { workosMembershipReads } from './workos-membership-reads.ts';
import type { WorkOSOrganizationsOptions } from './workos-organizations.ts';

// The largest page that WorkOS gives. The page limit bounds each read: 10,000 organizations, and 10,000 memberships of
// one organization.
const PAGE_SIZE = 100;
const PAGE_LIMIT = 100;
// A bounded message keeps a long answer of WorkOS out of the log.
const MESSAGE_LIMIT = 200;

interface WorkOSPage<T> {
  readonly data: readonly T[];
  readonly listMetadata: { readonly after?: string | null };
}

/** The calls of the pinned SDK client that the inventory needs. The WorkOS client fits this shape. */
export interface WorkOSInventoryClient extends Pick<WorkOS, 'get'> {
  readonly organizations: {
    listOrganizations(options: { readonly limit: number; readonly order: 'desc'; readonly after?: string }): Promise<WorkOSPage<{ readonly id: string }>>;
    getOrganization(organizationId: string): Promise<{ readonly id: string }>;
  };
}

/**
 * The organization inventory of the tenant sweeps over the WorkOS API. A list reads every page in order, and a failed,
 * repeated, or endless page makes the whole answer unavailable, so a partial list never looks complete. A read by ID
 * gives absent only for the 404 of WorkOS. No answer names a person: a membership is named by its ID.
 */
export class WorkOSOrganizationInventory implements OrganizationInventory {
  private readonly organizations: WorkOSInventoryClient['organizations'];
  private readonly memberships: WorkOSOrganizationsOptions['memberships'];

  constructor(client: WorkOSInventoryClient) {
    this.organizations = client.organizations;
    this.memberships = workosMembershipReads(client);
  }

  async listOrganizations(signal: AbortSignal): Promise<OrganizationList> {
    signal.throwIfAborted();
    try {
      return { status: 'complete', organizationIds: new Set(await this.organizationIds(signal)) };
    } catch (error) {
      signal.throwIfAborted();
      return { status: 'unavailable', reason: reasonOf(error) };
    }
  }

  async readOrganization(organizationId: string, signal: AbortSignal): Promise<OrganizationRead> {
    signal.throwIfAborted();
    try {
      const organization = await this.organizations.getOrganization(organizationId);
      return organization.id === organizationId ? { status: 'present' } : { status: 'unavailable', reason: 'WorkOS answered another organization' };
    } catch (error) {
      signal.throwIfAborted();
      return hasStatus(error, 404) ? { status: 'absent' } : { status: 'unavailable', reason: reasonOf(error) };
    }
  }

  /** The active memberships of every organization whose roles hold no role of the hosted mapping. */
  async defaultRoleMemberships(signal: AbortSignal): Promise<DefaultRoleRead> {
    signal.throwIfAborted();
    try {
      const memberships: DefaultRoleMembership[] = [];
      for (const organizationId of await this.organizationIds(signal)) memberships.push(...await this.defaultRoleMembershipsOf(organizationId, signal));
      return { status: 'complete', memberships };
    } catch (error) {
      signal.throwIfAborted();
      return { status: 'unavailable', reason: reasonOf(error) };
    }
  }

  private async organizationIds(signal: AbortSignal): Promise<readonly string[]> {
    const organizations = await everyPage((after) => this.organizations.listOrganizations({ limit: PAGE_SIZE, order: 'desc', ...afterOf(after) }), signal);
    return organizations.map(({ id }) => id);
  }

  private async defaultRoleMembershipsOf(organizationId: string, signal: AbortSignal): Promise<readonly DefaultRoleMembership[]> {
    const records = await everyPage((after) => this.memberships.listOrganizationMemberships({ organizationId, statuses: ['active'], limit: PAGE_SIZE, ...afterOf(after) }), signal);
    return records.filter((record) => {
      if (record.organizationId !== organizationId || record.status !== 'active') throw new Error('WorkOS answered a membership that the read did not ask for');
      if (record.roles === undefined) throw new Error('WorkOS answered a membership without a role list');
      return !record.roles.some(({ slug }) => isMappedRole(slug));
    }).map((record) => ({ organizationId, membershipId: record.id }));
  }
}

// Reads each page in order. A repeated cursor or more than the page limit fails, so that no partial list looks complete.
async function everyPage<T>(read: (after: string | undefined) => Promise<WorkOSPage<T>>, signal: AbortSignal): Promise<readonly T[]> {
  const items: T[] = [];
  const cursors = new Set<string>();
  let after: string | undefined;
  for (let pages = 0; pages < PAGE_LIMIT; pages += 1) {
    signal.throwIfAborted();
    const page = await read(after);
    items.push(...page.data);
    const next = page.listMetadata.after;
    if (typeof next !== 'string' || next === '') return items;
    if (cursors.has(next)) throw new Error(`WorkOS repeated the page cursor ${next.slice(0, MESSAGE_LIMIT)}`);
    cursors.add(next);
    after = next;
  }
  throw new Error(`WorkOS gave more than ${PAGE_LIMIT} pages`);
}

function afterOf(after: string | undefined): { readonly after?: string } {
  return after === undefined ? {} : { after };
}

// The SDK gives the status of a WorkOS answer on its errors, so the inventory reads it by shape, not by class.
function hasStatus(error: unknown, status: number): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === status;
}

function reasonOf(error: unknown): string {
  const message = (error instanceof Error ? error.message : String(error)).slice(0, MESSAGE_LIMIT);
  if (typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number') return `WorkOS answered ${error.status}: ${message}`;
  return message.startsWith('WorkOS') ? message : `no answer: ${message}`;
}
