import type {
  AddressRead, DeployRead, MemoryRead, RestartRead, ServiceChange, ServiceCreation, ServiceDeletion, ServiceSearch, TenantPlatform,
  TenantServiceRequest, TimeWindow,
} from './tenant-platform.ts';

/** The platform calls of the tenant loops: the provisioner and the sweeps. The deploy and the resume are not theirs. */
export type LoopPlatform = Pick<TenantPlatform, 'findServices' | 'createService' | 'newestDeploy' | 'internalAddress' | 'deleteService' | 'suspendService' | 'memoryUse' | 'restartCount'>;

/**
 * The platform of a loop of the control plane, such as the provisioner or the sweeps, for its stop (SO-12 rehearsal
 * of 31 October 2026). A call starts only while the signal of its caller, the stop signal of the loop, has not
 * stopped. A call that started runs with the in-flight signal instead, so the stop does not cut it, and its answer can
 * still reach the registry; the owner of the loop aborts the in-flight signal when the grace of the stop ends. The
 * repeats of a read in the adapter are part of its call.
 */
export class FinishingPlatform implements LoopPlatform {
  private readonly platform: LoopPlatform;
  private readonly inFlight: AbortSignal;

  constructor(platform: LoopPlatform, inFlight: AbortSignal) {
    this.platform = platform;
    this.inFlight = inFlight;
  }

  findServices(name: string, signal: AbortSignal): Promise<ServiceSearch> {
    return this.started(signal, (inFlight) => this.platform.findServices(name, inFlight));
  }

  createService(request: TenantServiceRequest, signal: AbortSignal): Promise<ServiceCreation> {
    return this.started(signal, (inFlight) => this.platform.createService(request, inFlight));
  }

  newestDeploy(serviceId: string, signal: AbortSignal): Promise<DeployRead> {
    return this.started(signal, (inFlight) => this.platform.newestDeploy(serviceId, inFlight));
  }

  internalAddress(serviceId: string, signal: AbortSignal): Promise<AddressRead> {
    return this.started(signal, (inFlight) => this.platform.internalAddress(serviceId, inFlight));
  }

  deleteService(serviceId: string, signal: AbortSignal): Promise<ServiceDeletion> {
    return this.started(signal, (inFlight) => this.platform.deleteService(serviceId, inFlight));
  }

  suspendService(serviceId: string, signal: AbortSignal): Promise<ServiceChange> {
    return this.started(signal, (inFlight) => this.platform.suspendService(serviceId, inFlight));
  }

  memoryUse(serviceIds: readonly string[], window: TimeWindow, signal: AbortSignal): Promise<MemoryRead> {
    return this.started(signal, (inFlight) => this.platform.memoryUse(serviceIds, window, inFlight));
  }

  restartCount(serviceId: string, window: TimeWindow, signal: AbortSignal): Promise<RestartRead> {
    return this.started(signal, (inFlight) => this.platform.restartCount(serviceId, window, inFlight));
  }

  private async started<T>(signal: AbortSignal, call: (inFlight: AbortSignal) => Promise<T>): Promise<T> {
    signal.throwIfAborted();
    return call(this.inFlight);
  }
}
