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

function placesTaken(count: RegistryCount): number {
  return PLACE_STATES.reduce((taken, state) => taken + (count.rowsByState.get(state) ?? 0), 0);
}
