import type { SystemLog } from '../../logs/system/system-logger.ts';
import type { WatchOutcome } from './tenant-deploy-watch.ts';
import { ProvisioningLog } from './tenant-provisioning-log.ts';
import type { LiveRecord, ProvisioningRow, RecordResult, TenantProvisioningStore } from './tenant-provisioning-store.ts';
import type { ServiceOutcome } from './tenant-service-attempt.ts';

/** done: the row has its end state or is left to another writer. store-failed: the row waits for the next claim. */
export type RowOutcome = 'done' | 'store-failed';

/**
 * The records of one row in the registry, each with its line for the operator. Each record names the state that it
 * starts from and the holder of the claim, so the work never overwrites the change of another writer or of another
 * loop: such a row is left as it is.
 */
export class RowRecords {
  private readonly store: TenantProvisioningStore;
  private readonly lines: ProvisioningLog;

  constructor(parts: { readonly store: TenantProvisioningStore; readonly log: SystemLog }) {
    this.store = parts.store;
    this.lines = new ProvisioningLog(parts.log);
  }

  claimed(row: ProvisioningRow, resumed: boolean): void {
    this.lines.record(row, row.state, resumed ? { resumed: true } : {});
  }

  /** The end of the work before the row has a service: failed on the service of its claim (none for a creating row), or the claim lost. */
  async unserved(row: ProvisioningRow, outcome: Exclude<ServiceOutcome, { status: 'service' }>): Promise<RowOutcome> {
    return outcome.status === 'lost' ? this.unrecorded(row, outcome.claim) : this.failed(row, row.serviceId, outcome.reason);
  }

  /** The end of the watch of the deploy of serviceId: live, failed, or the claim lost. */
  async watched(row: ProvisioningRow, serviceId: string, outcome: WatchOutcome): Promise<RowOutcome> {
    if (outcome.status === 'lost') return this.unrecorded(row, outcome.claim);
    return outcome.status === 'failed' ? this.failed(row, serviceId, outcome.reason) : this.live(row, serviceId, outcome.live);
  }

  /** creating to deploying. Undefined when the work goes on, else the outcome that ends it. */
  async service(row: ProvisioningRow, serviceId: string): Promise<RowOutcome | undefined> {
    const recorded = await this.store.recordService(row, serviceId);
    if (recorded.status !== 'recorded') return this.unrecorded(row, recorded);
    this.lines.record(row, 'deploying', { serviceId });
    return undefined;
  }

  /** deploying to live on the service of the work, with the address and the digest. */
  async live(row: ProvisioningRow, serviceId: string, live: LiveRecord): Promise<RowOutcome> {
    const recorded = await this.store.recordLive(row, serviceId, live);
    if (recorded.status !== 'recorded') return this.unrecorded(row, recorded);
    this.lines.record(row, 'live', { serviceId, ...live });
    return 'done';
  }

  /**
   * creating or deploying to failed on serviceId, the service of the work (null before the row has one), with one
   * report for the operator once the registry holds the failure.
   */
  async failed(row: ProvisioningRow, serviceId: string | null, reason: string): Promise<RowOutcome> {
    const recorded = await this.store.recordFailed(row, serviceId, reason);
    if (recorded.status !== 'recorded') return this.unrecorded(row, recorded);
    this.lines.failed(row, reason);
    return 'done';
  }

  /**
   * A write or a renewal of the claim that did not reach the row. moved: another writer changed the row, or another
   * loop claimed it, so this work must not touch it again. unavailable: the next claim comes back.
   */
  unrecorded(row: ProvisioningRow, result: RecordResult): RowOutcome {
    if (result.status === 'moved') {
      this.lines.left(row);
      return 'done';
    }
    this.lines.unwritten(row);
    return 'store-failed';
  }
}
