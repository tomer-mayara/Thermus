export interface ProvisioningRow {
  readonly organizationId: string;
  readonly state: 'creating' | 'deploying';
  readonly serviceName: string;
  readonly serviceId: string | null;
  /** The holder of the claim: the mark of the loop that works on the row. Each write of the work names it. */
  readonly holder: string;
}

/** The row of a live record and the holder of its claim; null for the fleet resume of the operator, which holds no claim. */
export interface LiveTarget {
  readonly organizationId: string;
  readonly holder: string | null;
}

export interface ClaimRequest {
  serviceNameOf(organizationId: string): string;
  readonly plan: string;
  /** The mark of the loop that claims. A row of another holder waits until the claim lease of that holder ends. */
  readonly holder: string;
}

/**
 * The next row to work on. A row in creating or deploying comes first: the work of an earlier run or a resume
 * (resumed). Else the oldest requested row moves to creating with its service name and plan. The claim holds the row
 * for the holder of the request for 60 s (the claim lease), so the loop of another instance leaves it.
 */
export type ClaimResult =
  | { readonly status: 'claimed'; readonly resumed: boolean; readonly row: ProvisioningRow }
  | { readonly status: 'idle' }
  | { readonly status: 'unavailable' };

/** moved: the row is no longer in the state that the change starts from. unavailable: the change can be absent. */
export type RecordResult = { readonly status: 'recorded' | 'moved' | 'unavailable' };

/**
 * The work of the loop on one claimed row: the renewal of the claim, which the work makes before each create and each
 * read of the deploy, and the stop signal of the loop, which ends each wait and each new platform call.
 */
export interface RowWork {
  renew(): Promise<RecordResult>;
  readonly signal: AbortSignal;
}

/** The claim did not renew: another loop holds the row or it left the work (moved), or the registry did not answer. */
export interface LostClaim {
  readonly status: 'lost';
  readonly claim: RecordResult;
}

export interface LiveRecord {
  readonly internalUrl: string;
  readonly imageDigest?: string;
}

/**
 * The provisioning statements of the registry. Each write of the work names the holder of the claim, so a loop whose
 * row another holder claimed after the lease ended writes nothing: its write is moved.
 */
export interface TenantProvisioningStore {
  claimNext(request: ClaimRequest): Promise<ClaimResult>;
  /**
   * Holds the row 60 s more for the holder of the claim. moved: another holder claimed the row, or the row left
   * creating and deploying.
   */
  renewClaim(row: ProvisioningRow): Promise<RecordResult>;
  /**
   * Frees the row of the holder for the next claim at once. A creating row stays held until its lease ends, because a
   * create of the work can still be unknown, and the next search by name must see the service that it made.
   */
  releaseClaim(row: ProvisioningRow): Promise<void>;
  /** creating to deploying, with the ID of the service. */
  recordService(row: ProvisioningRow, serviceId: string): Promise<RecordResult>;
  /**
   * deploying to live on serviceId, the service of the work, with the internal address and the digest of the live deploy.
   * A row that another writer gave a new service, such as after a delete, a revive, and a new provision, is moved. The
   * record frees the claim; a target without a holder, the fleet resume, records the row whoever holds it.
   */
  recordLive(row: LiveTarget, serviceId: string, live: LiveRecord): Promise<RecordResult>;
  /**
   * creating or deploying to failed on serviceId, the service of the work, with the reason. A row without a service
   * binds to null. A row that another writer gave a new service is moved.
   */
  recordFailed(row: ProvisioningRow, serviceId: string | null, reason: string): Promise<RecordResult>;
  /** True when a row of the registry has this service ID. An unreadable registry gives false. */
  ownsService(serviceId: string): Promise<boolean>;
}
