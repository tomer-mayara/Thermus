import type { RegistryCount, TenantState } from './tenant-registry-store.ts';

/** A row of the tenant registry as the fleet commands and the sweeps read it. Times are ISO 8601 in UTC. */
export interface FleetRow {
  readonly organizationId: string;
  readonly state: TenantState;
  /** The wanted plan of the platform, and the plan that the last live deploy applied. */
  readonly plan: string | null;
  readonly appliedPlan: string | null;
  readonly serviceId: string | null;
  readonly serviceName: string | null;
  readonly internalUrl: string | null;
  readonly imageDigest: string | null;
  readonly failureReason: string | null;
  readonly lastActiveAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Every row of the registry from one read, or unavailable: a partial read never looks complete. */
export type FleetRead =
  | { readonly status: 'complete'; readonly rows: readonly FleetRow[] }
  | { readonly status: 'unavailable' };

/** recorded: the row changed. moved: the row is absent or not in the state that the change starts from. unavailable: the change can be absent. */
export type FleetWrite = { readonly status: 'recorded' | 'moved' | 'unavailable' };

/** revived: the deleted row is requested again. refused: the decision did not admit it; the count says why. */
export type ReviveResult =
  | { readonly status: 'revived' }
  | { readonly status: 'refused'; readonly count: RegistryCount }
  | { readonly status: 'unavailable' | 'unconfirmed' };

/** claimed: the tick is for the holder of the claim to run. taken: another holder claimed it first. unavailable: the claim can be absent or present. */
export type TickClaim = { readonly status: 'claimed' | 'taken' | 'unavailable' };

/** A state that a row can leave for deleted. */
export type RemovableState = Exclude<TenantState, 'deleted'>;

/**
 * The registry statements of the fleet commands and the sweeps. Each change names the state and the service that it
 * starts from, so a change of another writer, such as the provisioner or the gateway, is never overwritten: such a row
 * is moved. A delete, a revive, and a new provision give the row of an organization a new service, so a slow operation
 * that read the old row cannot change the replacement row, also when the replacement is in the same state again.
 */
export interface TenantFleetStore {
  readFleet(): Promise<FleetRead>;
  /**
   * The rows that the idle sweep suspends: live, with a service, on the plan, and with a last use at or before cutoff,
   * or a creation at or before it when the row never served a call. cutoff is ISO 8601 in UTC.
   */
  readIdle(plan: string, cutoff: string): Promise<FleetRead>;
  /**
   * from, the state that the caller read, to deleted, after the platform deleted serviceId, the service that the caller
   * read (null for a row without a service). The row keeps its service ID and name for the record; its internal address
   * goes, so no route leads to the deleted service.
   */
  markDeleted(organizationId: string, from: RemovableState, serviceId: string | null): Promise<FleetWrite>;
  /**
   * deleted to requested inside the cap, under the registry lock: the request of "delete, then request". The row starts
   * again as a new request: its service, address, plans, digest, last use, and failure reason go, and its creation time
   * is now.
   */
  reviveDeleted(organizationId: string, admit: (count: RegistryCount) => boolean): Promise<ReviveResult>;
  /** live to suspended on the service that the caller read, after the platform took the suspend of that service. */
  markSuspended(organizationId: string, serviceId: string): Promise<FleetWrite>;
  /**
   * suspended to deploying on the service that the caller read, after the platform took the resume of that service; the
   * live record of the new deploy ends it.
   */
  markResumed(organizationId: string, serviceId: string): Promise<FleetWrite>;
  /** The digest of a live row, after an upgrade deploy on the same service reached live. */
  recordDigest(organizationId: string, serviceId: string, imageDigest: string): Promise<FleetWrite>;
  /**
   * The claim of a tick of the sweeps, at tickAt (ISO 8601 in UTC), for the holder of the claim. Only the first claim of
   * a tick is claimed, so one instance of the control plane runs it; the claim stays as the record of that instance.
   */
  claimTick(tickAt: string, holder: string): Promise<TickClaim>;
}
