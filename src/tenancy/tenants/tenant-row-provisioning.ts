import { watchDeploy, type WatchParts } from './tenant-deploy-watch.ts';
import type { ClaimResult, ProvisioningRow, TenantProvisioningStore } from './tenant-provisioning-store.ts';
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

  /** The work on one claimed row. Its end frees the row for the next claim, also after a stop or a failure. */
  async provision(claim: Extract<ClaimResult, { status: 'claimed' }>, signal: AbortSignal): Promise<RowOutcome> {
    const { row } = claim;
    this.records.claimed(row, claim.resumed);
    try {
      return await this.workOn(row, signal);
    } finally {
      await this.parts.store.releaseClaim(row);
    }
  }

  private async workOn(row: ProvisioningRow, signal: AbortSignal): Promise<RowOutcome> {
    const work = { renew: () => this.parts.store.renewClaim(row), signal };
    const service = await serviceOfRow(this.parts, row, work);
    if (service.status === 'lost') return this.records.unrecorded(row, service.claim);
    // Without a service, the row still has the service of its claim: none for a creating row.
    if (service.status === 'failed') return this.records.failed(row, row.serviceId, service.reason);
    // A deploying row has its service in the registry already, so only a creating row records it.
    const stop = row.state === 'creating' ? await this.records.service(row, service.serviceId) : undefined;
    if (stop !== undefined) return stop;
    const watched = await watchDeploy(this.parts, service.serviceId, work);
    if (watched.status === 'lost') return this.records.unrecorded(row, watched.claim);
    return watched.status === 'failed' ? this.records.failed(row, service.serviceId, watched.reason) : this.records.live(row, service.serviceId, watched.live);
  }
}
