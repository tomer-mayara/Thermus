import type { ReadRoutesResult, TenantRegistryStore, TenantRoute, TenantState } from './tenant-registry-store.ts';

// The answers of 27 October 2026: the copy refreshes every 10 s, and after a failed refresh it serves up to 60 s.
const REFRESH_AFTER_MS = 10_000;
const STALE_LIMIT_MS = 60_000;

export type TenantLookupResult =
  | { readonly status: 'found'; readonly state: TenantState; readonly internalUrl: string | null }
  | { readonly status: 'absent' }
  | { readonly status: 'unavailable' };

export type TenantCountResult =
  | { readonly status: 'counted'; readonly rowsByState: ReadonlyMap<TenantState, number> }
  | { readonly status: 'unavailable' };

interface RegistryCopy {
  readonly routes: ReadonlyMap<string, TenantRoute>;
  readonly readAt: number;
}

export class TenantLookup {
  private readonly store: Pick<TenantRegistryStore, 'readRoutes'>;
  private readonly now: () => number;
  private copy?: RegistryCopy;
  private refreshing?: Promise<void>;

  constructor(store: Pick<TenantRegistryStore, 'readRoutes'>, now: () => number = () => performance.now()) {
    this.store = store;
    this.now = now;
  }

  async find(organizationId: string): Promise<TenantLookupResult> {
    const routes = await this.currentRoutes();
    if (routes === undefined) return { status: 'unavailable' };
    const route = routes.get(organizationId);
    return route === undefined ? { status: 'absent' } : { status: 'found', ...route };
  }

  /**
   * The number of rows in each state, from the same copy and with the same bounds as find. Signup checks the
   * free-tenant cap with it before the agreement, so a signup page reads the registry only when the copy is 10 s old.
   */
  async countByState(): Promise<TenantCountResult> {
    const routes = await this.currentRoutes();
    if (routes === undefined) return { status: 'unavailable' };
    const rowsByState = new Map<TenantState, number>();
    for (const { state } of routes.values()) rowsByState.set(state, (rowsByState.get(state) ?? 0) + 1);
    return { status: 'counted', rowsByState };
  }

  // The routes of a copy that is not too old, after a refresh when the copy is 10 s old or more.
  private async currentRoutes(): Promise<ReadonlyMap<string, TenantRoute> | undefined> {
    if (this.age() >= REFRESH_AFTER_MS) await this.refresh();
    if (this.copy === undefined || this.age() >= STALE_LIMIT_MS) return undefined;
    return this.copy.routes;
  }

  private age(): number {
    return this.copy === undefined ? Infinity : this.now() - this.copy.readAt;
  }

  // Concurrent asks share one read. The age of a copy counts from the start of its read, so it never understates.
  private refresh(): Promise<void> {
    this.refreshing ??= this.read().finally(() => { this.refreshing = undefined; });
    return this.refreshing;
  }

  private async read(): Promise<void> {
    const readAt = this.now();
    const result: ReadRoutesResult = await this.store.readRoutes().catch(() => ({ status: 'unavailable' }));
    if (result.status === 'complete') this.copy = { routes: result.routes, readAt };
  }
}
