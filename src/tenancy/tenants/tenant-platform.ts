// The platform that runs the tenant containers, as the tenants owner needs it. The Render adapter implements it.
// Each operation gives a result for each answer of the platform; it rejects only when the caller's signal stops it.

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

export interface TenantPlatform {
  findServices(name: string, signal: AbortSignal): Promise<ServiceSearch>;
  createService(request: TenantServiceRequest, signal: AbortSignal): Promise<ServiceCreation>;
  newestDeploy(serviceId: string, signal: AbortSignal): Promise<DeployRead>;
  internalAddress(serviceId: string, signal: AbortSignal): Promise<AddressRead>;
  deleteService(serviceId: string, signal: AbortSignal): Promise<ServiceDeletion>;
}
