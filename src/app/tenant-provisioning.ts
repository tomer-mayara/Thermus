import type { SystemLog } from '../logs/system/system-logger.ts';
import { DeploymentConfigError } from '../runtime/config/deployment-config.ts';
import type { TenantProvisioningSettings } from '../runtime/config/mcp-tenants-config.ts';
import { RenderTenantPlatform } from '../tenancy/providers/render/render-tenant-platform.ts';
import type { ProvisioningClock } from '../tenancy/tenants/provisioning-clock.ts';
import type { TenantPlatform } from '../tenancy/tenants/tenant-platform.ts';
import { TenantProvisioner } from '../tenancy/tenants/tenant-provisioner.ts';
import type { TenantProvisioningStore } from '../tenancy/tenants/tenant-provisioning-store.ts';
import { platformResumeOf, type TenantResume } from '../tenancy/tenants/tenant-resume.ts';
import type { HostedLoggingStorage } from './logging-storage.ts';
import { systemClock } from './system-clock.ts';
import { startTenantSweeps, type TenantSweepsParts } from './tenant-sweeps.ts';

export interface TenantProvisioningParts {
  readonly settings: TenantProvisioningSettings;
  readonly publicBaseUrl: string;
  readonly authkitIssuer: string;
  readonly store: TenantProvisioningStore;
  readonly logger: SystemLog;
  // Seams of the tests. Production uses the global fetch and the system clock.
  readonly fetch?: typeof fetch;
  readonly clock?: ProvisioningClock;
}

export interface TenantProvisioning {
  /** Stops the loop and waits until its current step ends. A creating or deploying row continues at the next start. */
  close(): Promise<void>;
}

/** The Render adapter of the control plane, with the write guard of the tenant registry. */
export function tenantPlatformOf(parts: Pick<TenantProvisioningParts, 'settings' | 'fetch' | 'clock'> & { readonly store: Pick<TenantProvisioningStore, 'ownsService'> }): TenantPlatform {
  const { apiKey, ownerId, registryCredentialId, tenantImage } = parts.settings.render;
  return new RenderTenantPlatform({
    apiKey, ownerId, registryCredentialId, image: tenantImage, clock: parts.clock ?? systemClock,
    ownsService: (serviceId) => parts.store.ownsService(serviceId),
    ...(parts.fetch === undefined ? {} : { fetch: parts.fetch }),
  });
}

/** Starts the provisioner loop of the control plane. App owns its lifetime and closes it before the SQL runtime. */
export function startTenantProvisioning(parts: TenantProvisioningParts): TenantProvisioning {
  const { render, freePlan, namePrefix } = parts.settings;
  const controller = new AbortController();
  const running = provisionerOf(parts).run(controller.signal);
  parts.logger.info(`The tenant provisioner runs: Render workspace ${render.ownerId}, image ${render.tenantImage}, plan ${freePlan}, name prefix ${namePrefix}.`);
  // A second close aborts nothing more and waits for the same end of the loop.
  return { close: () => { controller.abort(new DOMException('The control plane is shutting down', 'AbortError')); return running; } };
}

function provisionerOf(parts: TenantProvisioningParts): TenantProvisioner {
  const { gatewayPublicKey, controlPlaneInternalUrl, namePrefix, freePlan } = parts.settings;
  return new TenantProvisioner({
    platform: tenantPlatformOf(parts), store: parts.store, clock: parts.clock ?? systemClock, log: parts.logger,
    tenant: { publicBaseUrl: parts.publicBaseUrl, authkitIssuer: parts.authkitIssuer, gatewayPublicKey, controlPlaneInternalUrl },
    namePrefix, freePlan,
  });
}

/** The tenant work of the control plane: the hosted storage with its loop and sweeps, and the resume call of the gateway. */
export interface ControlPlaneTenancy {
  /** The hosted storage, whose close stops the loop and the sweeps before the shared SQL runtime closes. */
  readonly storage: HostedLoggingStorage;
  /** The resume operation of the MCP gateway on the Render adapter (SO-10). */
  readonly resume: TenantResume;
}

/**
 * The hosted storage with the provisioner loop and the tenant sweeps, and the resume operation of the gateway. The loop
 * and the sweeps need the tenant registry, so the switch stops the start without the private hosted storage. Both
 * close before the shared SQL runtime. The sweeps and the resume share one Render adapter with the write guard of the
 * registry.
 */
export function withTenantProvisioning(storage: HostedLoggingStorage | undefined, parts: Omit<TenantProvisioningParts, 'store'> & Pick<TenantSweepsParts, 'workos' | 'sweepClock'>): ControlPlaneTenancy {
  if (storage?.tenants === undefined) {
    throw new DeploymentConfigError('MCP_TENANTS_ENABLED=true needs the tenant registry: DATABASE_URL and LOGGING_DESTINATION_ENCRYPTION_KEY must be valid.');
  }
  const { provisioning: store, fleet } = storage.tenants;
  const platform = tenantPlatformOf({ ...parts, store });
  const lifetimes = [startTenantProvisioning({ ...parts, store }), startTenantSweeps({ ...parts, platform, fleet })];
  return { storage: closingAfter(storage, lifetimes), resume: platformResumeOf(platform) };
}

// The storage whose close first stops each lifetime, so no loop or sweep runs on a closed SQL runtime.
function closingAfter(storage: HostedLoggingStorage, lifetimes: readonly { close(): Promise<void> }[]): HostedLoggingStorage {
  return { ...storage, close: async () => { await Promise.all(lifetimes.map((lifetime) => lifetime.close())); await storage.close(); } };
}
