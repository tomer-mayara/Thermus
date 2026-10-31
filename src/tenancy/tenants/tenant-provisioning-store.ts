export interface ProvisioningRow {
  readonly organizationId: string;
  readonly state: 'creating' | 'deploying';
  readonly serviceName: string;
  readonly serviceId: string | null;
}

export interface ClaimRequest {
  serviceNameOf(organizationId: string): string;
  readonly plan: string;
}

/**
 * The next row to work on. A row in creating or deploying comes first: the work of an earlier run or a resume
 * (resumed). Else the oldest requested row moves to creating with its service name and plan.
 */
export type ClaimResult =
  | { readonly status: 'claimed'; readonly resumed: boolean; readonly row: ProvisioningRow }
  | { readonly status: 'idle' }
  | { readonly status: 'unavailable' };

/** moved: the row is no longer in the state that the change starts from. unavailable: the change can be absent. */
export type RecordResult = { readonly status: 'recorded' | 'moved' | 'unavailable' };

export interface LiveRecord {
  readonly internalUrl: string;
  readonly imageDigest?: string;
}

export interface TenantProvisioningStore {
  claimNext(request: ClaimRequest): Promise<ClaimResult>;
  /** creating to deploying, with the ID of the service. */
  recordService(organizationId: string, serviceId: string): Promise<RecordResult>;
  /**
   * deploying to live on serviceId, the service of the work, with the internal address and the digest of the live deploy.
   * A row that another writer gave a new service, such as after a delete, a revive, and a new provision, is moved.
   */
  recordLive(organizationId: string, serviceId: string, live: LiveRecord): Promise<RecordResult>;
  /** creating or deploying to failed, with the reason. */
  recordFailed(organizationId: string, reason: string): Promise<RecordResult>;
  /** True when a row of the registry has this service ID. An unreadable registry gives false. */
  ownsService(serviceId: string): Promise<boolean>;
}
