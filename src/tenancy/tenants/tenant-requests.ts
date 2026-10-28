import type { TenantFleetStore } from './tenant-fleet-store.ts';
import type { RegistryCount, TenantRegistryStore, TenantState } from './tenant-registry-store.ts';

// Every row except a failed or a deleted one holds a place under the free-tenant cap (answer of 27 October 2026).
const PLACE_STATES: readonly TenantState[] = ['requested', 'creating', 'deploying', 'live', 'suspended'];

export type TenantRequestResult =
  | { readonly status: 'requested' }
  | { readonly status: 'present'; readonly state: TenantState }
  | { readonly status: 'full' }
  | { readonly status: 'unavailable' };

/** Requests the tenant of an organization: one idempotent insert of a `requested` row, inside the free-tenant cap. */
export class TenantRequests {
  private readonly store: TenantRegistryStore;
  private readonly freeTenantLimit: number;

  constructor(store: TenantRegistryStore, freeTenantLimit: number) {
    this.store = store;
    this.freeTenantLimit = freeTenantLimit;
  }

  async request(organizationId: string): Promise<TenantRequestResult> {
    const result = await this.store.insertRequested(organizationId, (count) => count.current === undefined && placesTaken(count) < this.freeTenantLimit);
    if (result.status === 'inserted') return { status: 'requested' };
    // A repeated request is safe: it finds the row of an unconfirmed insert that committed.
    if (result.status !== 'refused') return { status: 'unavailable' };
    return result.count.current === undefined ? { status: 'full' } : { status: 'present', state: result.count.current };
  }
}

/** absent: the organization has no row, so a request inserts one. present: its row is not deleted and stays. */
export type TenantRevivalResult =
  | { readonly status: 'revived' | 'absent' | 'full' | 'unavailable' }
  | { readonly status: 'present'; readonly state: TenantState };

/**
 * Requests the tenant of an organization again after its deletion: the deleted row moves to requested inside the
 * free-tenant cap, under the same lock as a request. A request alone keeps a deleted row (SO-04); the fleet request
 * and the repair "delete, then request" use this.
 */
export async function reviveTenant(store: Pick<TenantFleetStore, 'reviveDeleted'>, organizationId: string, freeTenantLimit: number): Promise<TenantRevivalResult> {
  const result = await store.reviveDeleted(organizationId, (count) => count.current === 'deleted' && placesTaken(count) < freeTenantLimit);
  if (result.status === 'revived') return result;
  if (result.status !== 'refused') return { status: 'unavailable' };
  const { current } = result.count;
  if (current === undefined) return { status: 'absent' };
  return current === 'deleted' ? { status: 'full' } : { status: 'present', state: current };
}

function placesTaken(count: RegistryCount): number {
  return PLACE_STATES.reduce((taken, state) => taken + (count.rowsByState.get(state) ?? 0), 0);
}
