import type { KeyObject } from 'node:crypto';
type Environment = Readonly<Record<string, string | undefined>>;
type Deployment = DeploymentConfig['deployment'];
export interface PublicUrls {
    readonly publicBaseUrl: string;
    readonly mcpResourceUrl: string;
    readonly resourceMetadataUrl: string;
}
interface SelfHostedConfig extends PublicUrls {
    readonly deployment: 'self-hosted';
    readonly dataDirectory: string;
}
interface HostedConfig extends PublicUrls {
    readonly deployment: 'hosted';
    readonly role: 'control-plane';
}
export interface TenantSettings {
    readonly organizationId: string;
    readonly gatewayPublicKeys: readonly KeyObject[];
    readonly controlPlaneInternalUrl: string;
    readonly authkitIssuer: string;
}
interface TenantConfig extends PublicUrls {
    readonly deployment: 'hosted';
    readonly role: 'tenant';
    readonly tenant: TenantSettings;
}
export type DeploymentConfig = SelfHostedConfig | HostedConfig | TenantConfig;
export interface ListenAddress {
    readonly host: string;
    readonly port: number;
}
export declare class DeploymentConfigError extends Error {
    constructor(message: string);
}
export declare function loadDeploymentConfig(environment: Environment, transport: 'http' | 'stdio'): DeploymentConfig;
export declare function loadListenAddress(environment: Environment): ListenAddress;
export declare function loadPublicUrls(environment: Environment, deployment: Deployment): PublicUrls;
export {};
