import type {
  AddressRead, DeployRead, ServiceCreation, ServiceDeletion, ServiceSearch, TenantPlatform, TenantServiceRequest,
} from '../../tenants/tenant-platform.ts';
import { RenderApi, type RenderClock } from './render-api.ts';
import type { ServiceSource } from './render-creation.ts';
import { RenderReads } from './render-reads.ts';
import { RenderWrites } from './render-writes.ts';

export { PRODUCTION_SERVICE_ID } from './render-writes.ts';

export interface RenderTenantPlatformOptions extends ServiceSource {
  // The key of the Render user of the control plane. Only the HTTP client of the adapter holds it.
  readonly apiKey: string;
  // The write guard: true when the tenant registry owns the service (answer 4 of 27 October 2026).
  readonly ownsService: (serviceId: string) => Promise<boolean>;
  readonly clock: RenderClock;
  readonly fetch?: typeof fetch;
}

/**
 * The tenant platform on Render, with the calls of the SO-01c probe. The reads repeat within their bound; the writes
 * go one time and pass the write guard first. One HTTP client holds the API key for both.
 */
export class RenderTenantPlatform implements TenantPlatform {
  private readonly reads: RenderReads;
  private readonly writes: RenderWrites;

  constructor(options: RenderTenantPlatformOptions) {
    const { apiKey, fetch: fetchFunction = globalThis.fetch, ownsService, clock, ...source } = options;
    const api = new RenderApi(apiKey, fetchFunction);
    this.reads = new RenderReads({ api, clock, ownerId: source.ownerId });
    this.writes = new RenderWrites({ api, clock, source, ownsService });
  }

  findServices(name: string, signal: AbortSignal): Promise<ServiceSearch> {
    return this.reads.findServices(name, signal);
  }

  createService(request: TenantServiceRequest, signal: AbortSignal): Promise<ServiceCreation> {
    return this.writes.createService(request, signal);
  }

  newestDeploy(serviceId: string, signal: AbortSignal): Promise<DeployRead> {
    return this.reads.newestDeploy(serviceId, signal);
  }

  internalAddress(serviceId: string, signal: AbortSignal): Promise<AddressRead> {
    return this.reads.internalAddress(serviceId, signal);
  }

  deleteService(serviceId: string, signal: AbortSignal): Promise<ServiceDeletion> {
    return this.writes.deleteService(serviceId, signal);
  }
}
