// The resources of one fleet command: the SQL runtime of the tenant registry with its stores, the Render adapter of the
// tenant platform, and the WorkOS organization inventory. Each opens at its first use, and close releases each one.
import { WorkOS } from '@workos-inc/node';
import { WorkOSOrganizationInventory } from '../../src/accounts/providers/workos/workos-organization-inventory.ts';
import { systemClock } from '../../src/app/system-clock.ts';
import { createPgSettingsRuntime, type BoundedSqlRuntime } from '../../src/runtime/sql/bounded-sql-runtime.ts';
import { RenderTenantPlatform } from '../../src/tenancy/providers/render/render-tenant-platform.ts';
import { PgTenantFleetStore } from '../../src/tenancy/tenants/pg-tenant-fleet-store.ts';
import { PgTenantProvisioningStore } from '../../src/tenancy/tenants/pg-tenant-provisioning-store.ts';
import { PgTenantRegistryStore } from '../../src/tenancy/tenants/pg-tenant-registry-store.ts';
import type { TenantPlatform } from '../../src/tenancy/tenants/tenant-platform.ts';
import { freePlanOf, registrySettingsOf, renderSettingsOf, workosSettingsOf } from './fleet-settings.ts';

type Environment = Readonly<Record<string, string | undefined>>;

/** A setting group that a command needs besides the registry. */
export type SettingNeed = 'render' | 'workos' | 'plan';

const NEED_CHECKS: Readonly<Record<SettingNeed, (environment: Environment) => unknown>> = { render: renderSettingsOf, workos: workosSettingsOf, plan: freePlanOf };

// Each WorkOS call of a command waits at most 10 s, with no retry of the SDK: the operator runs the command again.
const WORKOS_TIMEOUT_MS = 10_000;

export interface FleetStores {
  readonly fleet: PgTenantFleetStore;
  readonly registry: PgTenantRegistryStore;
  readonly provisioning: PgTenantProvisioningStore;
}

export class FleetContext {
  readonly environment: Environment;
  #runtime?: BoundedSqlRuntime;
  #stores?: FleetStores;
  #platform?: TenantPlatform;
  #inventory?: WorkOSOrganizationInventory;

  constructor(environment: Environment) {
    this.environment = environment;
  }

  /** Checks the registry settings and each needed group before the first call, so a refused setting stops at once. */
  async check(needs: readonly SettingNeed[]): Promise<void> {
    await registrySettingsOf(this.environment);
    for (const need of needs) NEED_CHECKS[need](this.environment);
  }

  async stores(): Promise<FleetStores> {
    if (this.#stores === undefined) {
      const runtime = createPgSettingsRuntime(await registrySettingsOf(this.environment));
      this.#runtime = runtime;
      this.#stores = { fleet: new PgTenantFleetStore(runtime), registry: new PgTenantRegistryStore(runtime), provisioning: new PgTenantProvisioningStore(runtime) };
    }
    return this.#stores;
  }

  /** The Render adapter with the write guard of the registry: it writes only to a service of a registry row. */
  async platform(): Promise<TenantPlatform> {
    if (this.#platform === undefined) {
      const { apiKey, ownerId } = renderSettingsOf(this.environment);
      const { provisioning } = await this.stores();
      // The fleet script never creates a service, so it gives no registry credential and no image: the provisioner of
      // the control plane creates each tenant with TENANT_IMAGE.
      this.#platform = new RenderTenantPlatform({ apiKey, ownerId, registryCredentialId: '', image: '', clock: systemClock, ownsService: (serviceId) => provisioning.ownsService(serviceId) });
    }
    return this.#platform;
  }

  inventory(): WorkOSOrganizationInventory {
    this.#inventory ??= new WorkOSOrganizationInventory(new WorkOS({ ...workosSettingsOf(this.environment), maxRetries: 0, timeout: WORKOS_TIMEOUT_MS }));
    return this.#inventory;
  }

  async close(): Promise<void> {
    await this.#runtime?.close();
  }
}
