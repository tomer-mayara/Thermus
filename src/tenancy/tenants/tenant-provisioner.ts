import { serviceNameOf } from './tenant-environment.ts';
import { RowProvisioning, type RowParts } from './tenant-row-provisioning.ts';

const IDLE_PAUSE_MS = 5_000;
const STORE_PAUSE_MS = 60_000;

export interface TenantProvisionerOptions extends RowParts {
  readonly namePrefix: string;
  /** The mark of this loop in the claims of the registry (claimed_by), one for each instance of the control plane. */
  readonly holder: string;
}

/**
 * The provisioning loop of the control plane (plan section 4.2). It works on one row at a time: it claims the row,
 * finds or creates its tenant service on the platform, watches the newest deploy, and records live or failed. It moves rows only from
 * requested to live and, after a resume, from deploying to live. Each step can repeat after a restart, because the
 * service is found by its name and the newest deploy is read again. The claim holds the row for this loop, so the loop
 * of a second instance during a deploy never works on it too. The caller owns the lifetime: run ends when its signal
 * stops it, and the signal also ends each wait and the next claim at once.
 */
export class TenantProvisioner {
  private readonly options: TenantProvisionerOptions;
  private readonly rows: RowProvisioning;

  constructor(options: TenantProvisionerOptions) {
    this.options = options;
    this.rows = new RowProvisioning(options);
  }

  async run(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      const pause = await this.next(signal).catch((error: unknown) => this.unexpected(error, signal));
      if (pause > 0) await this.options.clock.sleep(pause, signal).catch(() => undefined);
    }
  }

  private async next(signal: AbortSignal): Promise<number> {
    const { store, namePrefix, freePlan, log, holder } = this.options;
    const claim = await store.claimNext({ serviceNameOf: (organizationId) => serviceNameOf(namePrefix, organizationId), plan: freePlan, holder });
    if (claim.status === 'idle') return IDLE_PAUSE_MS;
    if (claim.status === 'unavailable') {
      log.error('Tenant provisioning cannot read the tenant registry. It tries again in 60 s.');
      return STORE_PAUSE_MS;
    }
    return await this.rows.provision(claim, signal) === 'store-failed' ? STORE_PAUSE_MS : 0;
  }

  private unexpected(error: unknown, signal: AbortSignal): number {
    if (signal.aborted) return 0;
    this.options.log.error(`Tenant provisioning failed unexpectedly: ${error instanceof Error ? error.message : String(error)}. It tries again in 60 s.`);
    return STORE_PAUSE_MS;
  }
}
