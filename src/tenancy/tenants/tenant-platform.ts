// The platform that runs the tenant containers, as the tenants owner needs it: the provisioner, the fleet commands, and
// the sweeps. A platform adapter under src/tenancy/providers/ implements it. Each operation gives a result for each
// answer of the platform; it rejects only when the caller's signal stops it.

/** A service of the platform with its exact name. */
export interface PlatformService {
  readonly id: string;
  readonly name: string;
}

/** The services that have the exact name of the search, from one complete answer of the platform. */
export type ServiceSearch =
  | { readonly status: 'found'; readonly services: readonly PlatformService[] }
  | { readonly status: 'unavailable'; readonly reason: string };

/** A new private service: its name, its plan, and each variable of its first deploy. */
export interface TenantServiceRequest {
  readonly name: string;
  readonly plan: string;
  readonly environment: ReadonlyMap<string, string>;
}

/**
 * The outcome of one create call, which the platform sends one time only. rate-limited and refused mean that the
 * platform made no service. unknown means that the call got no clear answer, so the service can exist: search by
 * name before another create.
 */
export type ServiceCreation =
  | { readonly status: 'created'; readonly service: PlatformService }
  | { readonly status: 'rate-limited'; readonly retryAfterMs: number }
  | { readonly status: 'refused'; readonly reason: string }
  | { readonly status: 'unknown'; readonly reason: string };

export type DeployProgress = 'pending' | 'live' | 'failed';

export interface PlatformDeploy {
  readonly id: string;
  readonly progress: DeployProgress;
  // The status of the platform, such as update_in_progress or update_failed.
  readonly status: string;
  // The digest of the image that the deploy runs, when the platform gives it.
  readonly imageDigest?: string;
}

/** The newest deploy of a service. gone means that the service no longer exists. */
export type DeployRead =
  | { readonly status: 'found'; readonly deploy: PlatformDeploy }
  | { readonly status: 'none' }
  | { readonly status: 'gone' }
  | { readonly status: 'unavailable'; readonly reason: string };

/** The address of a service on the private network. pending: the platform does not give it yet. */
export type AddressRead =
  | { readonly status: 'found'; readonly internalUrl: string }
  | { readonly status: 'pending' }
  | { readonly status: 'unavailable'; readonly reason: string };

/** A delete; an absent service counts as deleted. refused: the platform adapter or the platform refused the write. */
export type ServiceDeletion =
  | { readonly status: 'deleted' }
  | { readonly status: 'refused' | 'unavailable'; readonly reason: string };

/**
 * The outcome of one deploy of an image by digest, which the platform sends one time only. started: the platform took
 * the deploy; deploy is the new deploy when the answer gives it. rate-limited and refused: no deploy started. unknown:
 * the call got no clear answer, so a deploy can run: read the newest deploy before another one. gone: the service no
 * longer exists.
 */
export type DeployStart =
  | { readonly status: 'started'; readonly deploy?: PlatformDeploy }
  | { readonly status: 'rate-limited'; readonly retryAfterMs: number }
  | { readonly status: 'refused' | 'unknown'; readonly reason: string }
  | { readonly status: 'gone' };

/** The outcome of one suspend or resume call, which the platform sends one time only; the other outcomes as for a deploy. */
export type ServiceChange =
  | { readonly status: 'accepted' }
  | { readonly status: 'rate-limited'; readonly retryAfterMs: number }
  | { readonly status: 'refused' | 'unknown'; readonly reason: string }
  | { readonly status: 'gone' };

/** A time window in milliseconds since the epoch: from startMs to endMs. */
export interface TimeWindow {
  readonly startMs: number;
  readonly endMs: number;
}

/** The memory of one service in a window, in bytes: its highest point, and the limit of its plan when the platform gives it. */
export interface MemoryUse {
  readonly peakBytes: number;
  readonly limitBytes?: number;
}

/** The memory of each service that has a point in the window; a service without a point is absent from the map. */
export type MemoryRead =
  | { readonly status: 'found'; readonly services: ReadonlyMap<string, MemoryUse> }
  | { readonly status: 'unavailable'; readonly reason: string };

/** The restarts of a service in a window that the platform reports outside a deploy, such as a crash or a kill for memory. */
export type RestartRead =
  | { readonly status: 'found'; readonly restarts: number }
  | { readonly status: 'gone' }
  | { readonly status: 'unavailable'; readonly reason: string };

export interface TenantPlatform {
  findServices(name: string, signal: AbortSignal): Promise<ServiceSearch>;
  createService(request: TenantServiceRequest, signal: AbortSignal): Promise<ServiceCreation>;
  newestDeploy(serviceId: string, signal: AbortSignal): Promise<DeployRead>;
  internalAddress(serviceId: string, signal: AbortSignal): Promise<AddressRead>;
  deleteService(serviceId: string, signal: AbortSignal): Promise<ServiceDeletion>;
  /** Deploys an image reference by digest, such as ghcr.io/owner/name@sha256:<64 hexadecimal digits>, to the service. */
  deployImage(serviceId: string, image: string, signal: AbortSignal): Promise<DeployStart>;
  /** Stops the service; it costs nothing while suspended. */
  suspendService(serviceId: string, signal: AbortSignal): Promise<ServiceChange>;
  /** Starts a suspended service again; the platform then starts a new deploy. */
  resumeService(serviceId: string, signal: AbortSignal): Promise<ServiceChange>;
  /** The memory of the services in the window, from one complete answer of the platform. */
  memoryUse(serviceIds: readonly string[], window: TimeWindow, signal: AbortSignal): Promise<MemoryRead>;
  restartCount(serviceId: string, window: TimeWindow, signal: AbortSignal): Promise<RestartRead>;
}
