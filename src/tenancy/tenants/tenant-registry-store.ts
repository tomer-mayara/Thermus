export type TenantState = 'requested' | 'creating' | 'deploying' | 'live' | 'suspended' | 'failed' | 'deleted';

/** The way to the container of one organization. The internal address is null until the provisioner records it. */
export interface TenantRoute {
  readonly state: TenantState;
  readonly internalUrl: string | null;
}

export interface RegistryCount {
  /** The state of the row of the requesting organization; absent when it has no row. */
  readonly current?: TenantState;
  readonly rowsByState: ReadonlyMap<TenantState, number>;
}

export type InsertRequestedResult =
  | { readonly status: 'inserted' }
  | { readonly status: 'refused'; readonly count: RegistryCount }
  | { readonly status: 'unavailable' | 'unconfirmed' };

export type ReadRoutesResult =
  | { readonly status: 'complete'; readonly routes: ReadonlyMap<string, TenantRoute> }
  | { readonly status: 'unavailable' };

export interface TenantRegistryStore {
  /** Counts the rows and inserts a `requested` row when `admit` allows it, under one lock and in one transaction. */
  insertRequested(organizationId: string, admit: (count: RegistryCount) => boolean): Promise<InsertRequestedResult>;
  readRoutes(): Promise<ReadRoutesResult>;
}
