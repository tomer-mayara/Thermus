import type { ReadRoutesResult, TenantRegistryStore, TenantRoute, TenantState } from './tenant-registry-store.ts';

// The answers of 27 October 2026: the copy refreshes every 10 s, and after a failed refresh it serves up to 60 s.
const REFRESH_AFTER_MS = 10_000;
const STALE_LIMIT_MS = 60_000;

export type TenantLookupResult =
  | { readonly status: 'found'; readonly state: TenantState; readonly internalUrl: string | null }
  | { readonly status: 'absent' }
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
    if (this.age() >= REFRESH_AFTER_MS) await this.refresh();
    if (this.copy === undefined || this.age() >= STALE_LIMIT_MS) return { status: 'unavailable' };
    const route = this.copy.routes.get(organizationId);
    return route === undefined ? { status: 'absent' } : { status: 'found', ...route };
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
