import type { SystemLog } from '../logs/system/system-logger.ts';
import { DeploymentConfigError } from '../runtime/config/deployment-config.ts';
import type { TenantProvisioningSettings } from '../runtime/config/mcp-tenants-config.ts';
import { RenderTenantPlatform } from '../tenancy/providers/render/render-tenant-platform.ts';
import type { ProvisioningClock } from '../tenancy/tenants/provisioning-clock.ts';
import type { TenantPlatform } from '../tenancy/tenants/tenant-platform.ts';
import { TenantProvisioner } from '../tenancy/tenants/tenant-provisioner.ts';
import type { TenantProvisioningStore } from '../tenancy/tenants/tenant-provisioning-store.ts';
import type { HostedLoggingStorage } from './logging-storage.ts';

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

/** The monotonic clock of the process, with a wait that a stop signal ends. */
export const systemClock: ProvisioningClock = {
  now: () => performance.now(),
  sleep: (ms, signal) => new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const stop = (): void => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', stop);
      resolve();
    }, ms);
    signal.addEventListener('abort', stop, { once: true });
  }),
};

/** The Render adapter of the control plane, with the write guard of the tenant registry. */
export function tenantPlatformOf(parts: Pick<TenantProvisioningParts, 'settings' | 'store' | 'fetch' | 'clock'>): TenantPlatform {
  const { apiKey, ownerId, registryCredentialId, tenantImage } = parts.settings.render;
  return new RenderTenantPlatform({
    apiKey, ownerId, registryCredentialId, image: tenantImage, clock: parts.clock ?? systemClock,
    ownsService: (serviceId) => parts.store.ownsService(serviceId),
    ...(parts.fetch === undefined ? {} : { fetch: parts.fetch }),
  });
}

/** Starts the provisioner loop of the control plane. App owns its lifetime and closes it before the SQL runtime. */
export function startTenantProvisioning(parts: TenantProvisioningParts): TenantProvisioning {
  const { settings, logger } = parts;
  const provisioner = new TenantProvisioner({
    platform: tenantPlatformOf(parts),
    store: parts.store,
    clock: parts.clock ?? systemClock,
    log: logger,
    tenant: { publicBaseUrl: parts.publicBaseUrl, authkitIssuer: parts.authkitIssuer, gatewayPublicKey: settings.gatewayPublicKey, controlPlaneInternalUrl: settings.controlPlaneInternalUrl },
    namePrefix: settings.namePrefix,
    freePlan: settings.freePlan,
  });
  const controller = new AbortController();
  const running = provisioner.run(controller.signal);
  logger.info(`The tenant provisioner runs: Render workspace ${settings.render.ownerId}, image ${settings.render.tenantImage}, plan ${settings.freePlan}, name prefix ${settings.namePrefix}.`);
  let closing: Promise<void> | undefined;
  return {
    close: () => {
      if (closing === undefined) {
        controller.abort(new DOMException('The control plane is shutting down', 'AbortError'));
        closing = running;
      }
      return closing;
    },
  };
}

/**
 * The hosted storage with the provisioner loop. The loop needs the tenant registry, so the switch stops the start
 * without the private hosted storage. The loop closes before the shared SQL runtime.
 */
export function withTenantProvisioning(storage: HostedLoggingStorage | undefined, parts: Omit<TenantProvisioningParts, 'store'>): HostedLoggingStorage {
  if (storage?.tenants === undefined) {
    throw new DeploymentConfigError('MCP_TENANTS_ENABLED=true needs the tenant registry: DATABASE_URL and LOGGING_DESTINATION_ENCRYPTION_KEY must be valid.');
  }
  const provisioning = startTenantProvisioning({ ...parts, store: storage.tenants.provisioning });
  return { ...storage, close: async () => { await provisioning.close(); await storage.close(); } };
}
