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
export type DeployStart = {
    readonly status: 'started';
    readonly deploy?: PlatformDeploy;
} | {
    readonly status: 'rate-limited';
    readonly retryAfterMs: number;
} | {
    readonly status: 'refused' | 'unknown';
    readonly reason: string;
} | {
    readonly status: 'gone';
};
export type ServiceChange = {
    readonly status: 'accepted';
} | {
    readonly status: 'rate-limited';
    readonly retryAfterMs: number;
} | {
    readonly status: 'refused' | 'unknown';
    readonly reason: string;
} | {
    readonly status: 'gone';
};
export interface TimeWindow {
    readonly startMs: number;
    readonly endMs: number;
}
export interface MemoryUse {
    readonly peakBytes: number;
    readonly limitBytes?: number;
}
export type MemoryRead = {
    readonly status: 'found';
    readonly services: ReadonlyMap<string, MemoryUse>;
} | {
    readonly status: 'unavailable';
    readonly reason: string;
};
export type RestartRead = {
    readonly status: 'found';
    readonly restarts: number;
} | {
    readonly status: 'gone';
} | {
    readonly status: 'unavailable';
    readonly reason: string;
};
export interface TenantPlatform {
    findServices(name: string, signal: AbortSignal): Promise<ServiceSearch>;
    createService(request: TenantServiceRequest, signal: AbortSignal): Promise<ServiceCreation>;
    newestDeploy(serviceId: string, signal: AbortSignal): Promise<DeployRead>;
    internalAddress(serviceId: string, signal: AbortSignal): Promise<AddressRead>;
    deleteService(serviceId: string, signal: AbortSignal): Promise<ServiceDeletion>;
    deployImage(serviceId: string, image: string, signal: AbortSignal): Promise<DeployStart>;
    suspendService(serviceId: string, signal: AbortSignal): Promise<ServiceChange>;
    resumeService(serviceId: string, signal: AbortSignal): Promise<ServiceChange>;
    memoryUse(serviceIds: readonly string[], window: TimeWindow, signal: AbortSignal): Promise<MemoryRead>;
    restartCount(serviceId: string, window: TimeWindow, signal: AbortSignal): Promise<RestartRead>;
}
