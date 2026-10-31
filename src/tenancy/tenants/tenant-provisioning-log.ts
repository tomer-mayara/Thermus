import type { SystemLog } from '../../logs/system/system-logger.ts';
import type { ProvisioningRow } from './tenant-provisioning-store.ts';

/**
 * The lines that the operator gets from the provisioner, one line each, as the account change records are (plan
 * section 4.3). A record line is JSON, so a monitor can read it; a failure report is one ERROR line, which the
 * alerts of SO-11 watch. No line holds a key or a variable value of a tenant.
 */
export class ProvisioningLog {
  private readonly log: SystemLog;

  constructor(log: SystemLog) {
    this.log = log;
  }

  record(row: ProvisioningRow, state: string, details: Readonly<Record<string, unknown>>): void {
    this.log.info(`Tenant provisioning record: ${JSON.stringify({ organizationId: row.organizationId, state, serviceName: row.serviceName, ...details })}`);
  }

  failed(row: ProvisioningRow, reason: string): void {
    this.log.error(`Tenant provisioning failed: ${JSON.stringify({ organizationId: row.organizationId, serviceName: row.serviceName, reason })}`);
  }

  left(row: ProvisioningRow): void {
    this.log.info(`Tenant provisioning leaves organization ${row.organizationId}: its row changed during the work.`);
  }

  unwritten(row: ProvisioningRow): void {
    this.log.error(`Tenant provisioning could not write the row of organization ${row.organizationId}. It tries again in 60 s.`);
  }
}
