import type { SystemLog } from '../../logs/system/system-logger.ts';
import { ProvisioningLog } from './tenant-provisioning-log.ts';
import type { LiveRecord, ProvisioningRow, RecordResult, TenantProvisioningStore } from './tenant-provisioning-store.ts';

/** done: the row has its end state or is left to another writer. store-failed: the row waits for the next claim. */
export type RowOutcome = 'done' | 'store-failed';

/**
 * The records of one row in the registry, each with its line for the operator. Each record names the state that it
 * starts from, so the work never overwrites the change of another writer: such a row is left as it is.
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

  /** creating to deploying. Undefined when the work goes on, else the outcome that ends it. */
  async service(row: ProvisioningRow, serviceId: string): Promise<RowOutcome | undefined> {
    const recorded = await this.store.recordService(row.organizationId, serviceId);
    if (recorded.status !== 'recorded') return this.unrecorded(row, recorded);
    this.lines.record(row, 'deploying', { serviceId });
    return undefined;
  }

  /** deploying to live on the service of the work, with the address and the digest. */
  async live(row: ProvisioningRow, serviceId: string, live: LiveRecord): Promise<RowOutcome> {
    const recorded = await this.store.recordLive(row.organizationId, serviceId, live);
    if (recorded.status !== 'recorded') return this.unrecorded(row, recorded);
    this.lines.record(row, 'live', { serviceId, ...live });
    return 'done';
  }

  /** creating or deploying to failed, with one report for the operator once the registry holds the failure. */
  async failed(row: ProvisioningRow, reason: string): Promise<RowOutcome> {
    const recorded = await this.store.recordFailed(row.organizationId, reason);
    if (recorded.status !== 'recorded') return this.unrecorded(row, recorded);
    this.lines.failed(row, reason);
    return 'done';
  }

  // moved: another writer changed the row, so this work must not touch it again. unavailable: the next claim comes back.
  private unrecorded(row: ProvisioningRow, result: RecordResult): RowOutcome {
    if (result.status === 'moved') {
      this.lines.left(row);
      return 'done';
    }
    this.lines.unwritten(row);
    return 'store-failed';
  }
}
