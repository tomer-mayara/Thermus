import type {
  AddressRead, DeployRead, DeployStart, MemoryRead, RestartRead, ServiceChange, ServiceCreation, ServiceDeletion, ServiceSearch, TenantPlatform,
  TenantServiceRequest, TimeWindow,
} from '../../tenants/tenant-platform.ts';
import { RenderApi, type RenderClock } from './render-api.ts';
import type { ServiceSource } from './render-creation.ts';
import { RenderMetrics } from './render-metrics.ts';
import { RenderReads } from './render-reads.ts';
import { RenderWrites } from './render-writes.ts';

export { PRODUCTION_SERVICE_ID } from './render-writes.ts';

export interface RenderTenantPlatformOptions extends ServiceSource {
  // The key of the Render user of the control plane. Only the HTTP client of the adapter holds it.
  readonly apiKey: string;
  readonly ownsService: (serviceId: string) => Promise<boolean>;
  readonly clock: RenderClock;
  readonly fetch?: typeof fetch;
}

/**
 * The tenant platform on Render, with the calls of the SO-01c and SO-01e probes. The reads repeat within their bound;
 * the writes go one time and pass the write guard first. One HTTP client holds the API key for all of them.
 */
export class RenderTenantPlatform implements TenantPlatform {
  private readonly reads: RenderReads;
  private readonly writes: RenderWrites;
  private readonly metrics: RenderMetrics;

  constructor(options: RenderTenantPlatformOptions) {
    const { apiKey, fetch: fetchFunction = globalThis.fetch, ownsService, clock, ...source } = options;
    const api = new RenderApi(apiKey, fetchFunction);
    this.reads = new RenderReads({ api, clock, ownerId: source.ownerId });
    this.writes = new RenderWrites({ api, clock, source, ownsService });
    this.metrics = new RenderMetrics({ api, clock });
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

  deployImage(serviceId: string, image: string, signal: AbortSignal): Promise<DeployStart> {
    return this.writes.deployImage(serviceId, image, signal);
  }

  suspendService(serviceId: string, signal: AbortSignal): Promise<ServiceChange> {
    return this.writes.suspendService(serviceId, signal);
  }

  resumeService(serviceId: string, signal: AbortSignal): Promise<ServiceChange> {
    return this.writes.resumeService(serviceId, signal);
  }

  memoryUse(serviceIds: readonly string[], window: TimeWindow, signal: AbortSignal): Promise<MemoryRead> {
    return this.metrics.memoryUse(serviceIds, window, signal);
  }

  restartCount(serviceId: string, window: TimeWindow, signal: AbortSignal): Promise<RestartRead> {
    return this.metrics.restartCount(serviceId, window, signal);
  }
}
