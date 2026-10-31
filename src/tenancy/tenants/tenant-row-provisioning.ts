import { watchDeploy, type WatchParts } from './tenant-deploy-watch.ts';
import type { ClaimResult, TenantProvisioningStore } from './tenant-provisioning-store.ts';
import { RowRecords, type RowOutcome } from './tenant-row-records.ts';
import { serviceOfRow, type CreationParts } from './tenant-service-creation.ts';

export type { RowOutcome } from './tenant-row-records.ts';

export interface RowParts extends CreationParts {
  // One platform serves both steps; each step module names only the calls that it needs.
  readonly platform: CreationParts['platform'] & WatchParts['platform'];
  readonly store: TenantProvisioningStore;
}

export class RowProvisioning {
  private readonly parts: RowParts;
  private readonly records: RowRecords;

  constructor(parts: RowParts) {
    this.parts = parts;
    this.records = new RowRecords(parts);
  }

  async provision(claim: Extract<ClaimResult, { status: 'claimed' }>, signal: AbortSignal): Promise<RowOutcome> {
    const { row } = claim;
    this.records.claimed(row, claim.resumed);
    const service = await serviceOfRow(this.parts, row, signal);
    if (service.status === 'failed') return this.records.failed(row, service.reason);
    // A deploying row has its service in the registry already, so only a creating row records it.
    const stop = row.state === 'creating' ? await this.records.service(row, service.serviceId) : undefined;
    if (stop !== undefined) return stop;
    const watched = await watchDeploy(this.parts, service.serviceId, signal);
    return watched.status === 'failed' ? this.records.failed(row, watched.reason) : this.records.live(row, service.serviceId, watched.live);
  }
}
