import type { SystemLog } from '../../logs/system/system-logger.ts';
import type { ProvisioningClock } from './provisioning-clock.ts';
import { freeTenantEnvironment, serviceNameOf, type TenantPublicSettings } from './tenant-environment.ts';
import { watchDeploy } from './tenant-deploy-watch.ts';
import type { TenantPlatform } from './tenant-platform.ts';
import type { ProvisioningRow, RecordResult, TenantProvisioningStore } from './tenant-provisioning-store.ts';
import { serviceForRow, type ServiceOutcome } from './tenant-service-creation.ts';

const IDLE_PAUSE_MS = 5_000;
const STORE_PAUSE_MS = 60_000;

export interface TenantProvisionerOptions {
  readonly platform: TenantPlatform;
  readonly store: TenantProvisioningStore;
  readonly clock: ProvisioningClock;
  readonly log: SystemLog;
  readonly tenant: TenantPublicSettings;
  readonly namePrefix: string;
  readonly freePlan: string;
}

type RowOutcome = 'done' | 'store-failed';

/**
 * The provisioning loop of the control plane (plan section 4.2). It works on one row at a time: it claims the row,
 * finds or creates its Render service, watches the newest deploy, and records live or failed. It moves rows only from
 * requested to live and, after a resume, from deploying to live. Each step can repeat after a restart, because the
 * service is found by its name and the newest deploy is read again. The caller owns the lifetime: run ends when its
 * signal stops it.
 */
export class TenantProvisioner {
  private readonly options: TenantProvisionerOptions;

  constructor(options: TenantProvisionerOptions) {
    this.options = options;
  }

  async run(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      const pause = await this.next(signal).catch((error: unknown) => this.unexpected(error, signal));
      if (pause > 0) await this.options.clock.sleep(pause, signal).catch(() => undefined);
    }
  }

  // Returns the pause before the next claim.
  private async next(signal: AbortSignal): Promise<number> {
    const { store, namePrefix, freePlan, log } = this.options;
    const claim = await store.claimNext({ serviceNameOf: (organizationId) => serviceNameOf(namePrefix, organizationId), plan: freePlan });
    if (claim.status === 'idle') return IDLE_PAUSE_MS;
    if (claim.status === 'unavailable') {
      log.error('Tenant provisioning cannot read the tenant registry. It tries again in 60 s.');
      return STORE_PAUSE_MS;
    }
    this.record(claim.row, claim.row.state, claim.resumed ? { resumed: true } : {});
    return await this.provision(claim.row, signal) === 'store-failed' ? STORE_PAUSE_MS : 0;
  }

  private async provision(row: ProvisioningRow, signal: AbortSignal): Promise<RowOutcome> {
    const service = row.state === 'creating' ? await this.serviceOf(row, signal) : existingService(row);
    if (service.status === 'failed') return this.fail(row, service.reason);
    const { serviceId } = service;
    if (row.state === 'creating') {
      const recorded = await this.options.store.recordService(row.organizationId, serviceId);
      if (recorded.status !== 'recorded') return this.unrecorded(row, recorded);
      this.record(row, 'deploying', { serviceId });
    }
    const watched = await watchDeploy(this.options, serviceId, signal);
    if (watched.status === 'failed') return this.fail(row, watched.reason);
    const live = { internalUrl: watched.internalUrl, ...(watched.imageDigest === undefined ? {} : { imageDigest: watched.imageDigest }) };
    const recorded = await this.options.store.recordLive(row.organizationId, live);
    if (recorded.status !== 'recorded') return this.unrecorded(row, recorded);
    this.record(row, 'live', { serviceId, ...live });
    return 'done';
  }

  private serviceOf(row: ProvisioningRow, signal: AbortSignal): Promise<ServiceOutcome> {
    const { tenant, freePlan } = this.options;
    const request = { name: row.serviceName, plan: freePlan, environment: freeTenantEnvironment(row.organizationId, tenant) };
    return serviceForRow(this.options, { organizationId: row.organizationId, request }, signal);
  }

  // One report for the operator, when the registry holds the failure.
  private async fail(row: ProvisioningRow, reason: string): Promise<RowOutcome> {
    const recorded = await this.options.store.recordFailed(row.organizationId, reason);
    if (recorded.status !== 'recorded') return this.unrecorded(row, recorded);
    this.options.log.error(`Tenant provisioning failed: ${JSON.stringify({ organizationId: row.organizationId, serviceName: row.serviceName, reason })}`);
    return 'done';
  }

  private unrecorded(row: ProvisioningRow, result: RecordResult): RowOutcome {
    if (result.status === 'moved') {
      this.options.log.info(`Tenant provisioning leaves organization ${row.organizationId}: its row changed during the work.`);
      return 'done';
    }
    this.options.log.error(`Tenant provisioning could not write the row of organization ${row.organizationId}. It tries again in 60 s.`);
    return 'store-failed';
  }

  private record(row: ProvisioningRow, state: string, details: Readonly<Record<string, unknown>>): void {
    this.options.log.info(`Tenant provisioning record: ${JSON.stringify({ organizationId: row.organizationId, state, serviceName: row.serviceName, ...details })}`);
  }

  private unexpected(error: unknown, signal: AbortSignal): number {
    if (signal.aborted) return 0;
    this.options.log.error(`Tenant provisioning failed unexpectedly: ${error instanceof Error ? error.message : String(error)}. It tries again in 60 s.`);
    return STORE_PAUSE_MS;
  }
}

function existingService(row: ProvisioningRow): ServiceOutcome {
  return row.serviceId === null ? { status: 'failed', reason: 'The deploying row has no Render service ID' } : { status: 'service', serviceId: row.serviceId };
}
