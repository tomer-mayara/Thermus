export interface PlatformService {
    readonly id: string;
    readonly name: string;
}
export type ServiceSearch = {
    readonly status: 'found';
    readonly services: readonly PlatformService[];
} | {
    readonly status: 'unavailable';
    readonly reason: string;
};
export interface TenantServiceRequest {
    readonly name: string;
    readonly plan: string;
    readonly environment: ReadonlyMap<string, string>;
}
export type ServiceCreation = {
    readonly status: 'created';
    readonly service: PlatformService;
} | {
    readonly status: 'rate-limited';
    readonly retryAfterMs: number;
} | {
    readonly status: 'refused';
    readonly reason: string;
} | {
    readonly status: 'unknown';
    readonly reason: string;
};
export type DeployProgress = 'pending' | 'live' | 'failed';
export interface PlatformDeploy {
    readonly id: string;
    readonly progress: DeployProgress;
    readonly status: string;
    readonly imageDigest?: string;
}
export type DeployRead = {
    readonly status: 'found';
    readonly deploy: PlatformDeploy;
} | {
    readonly status: 'none';
} | {
    readonly status: 'gone';
} | {
    readonly status: 'unavailable';
    readonly reason: string;
};
export type AddressRead = {
    readonly status: 'found';
    readonly internalUrl: string;
} | {
    readonly status: 'pending';
} | {
    readonly status: 'unavailable';
    readonly reason: string;
};
export type ServiceDeletion = {
    readonly status: 'deleted';
} | {
    readonly status: 'refused' | 'unavailable';
    readonly reason: string;
};
export interface TenantPlatform {
    findServices(name: string, signal: AbortSignal): Promise<ServiceSearch>;
    createService(request: TenantServiceRequest, signal: AbortSignal): Promise<ServiceCreation>;
    newestDeploy(serviceId: string, signal: AbortSignal): Promise<DeployRead>;
    internalAddress(serviceId: string, signal: AbortSignal): Promise<AddressRead>;
    deleteService(serviceId: string, signal: AbortSignal): Promise<ServiceDeletion>;
}
