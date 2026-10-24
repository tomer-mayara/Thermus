import type { MCPServer } from './mcp-server.ts';
export interface ProtectedResourceEndpointOptions {
    readonly server: Pick<MCPServer, 'fetch' | 'close'>;
    readonly mcpResourceUrl: string;
    readonly resourceMetadataUrl: string;
    readonly authorizationServer: string;
}
export declare class ProtectedResourceEndpoint {
    private readonly server;
    private readonly metadataPaths;
    private readonly metadata;
    constructor(options: ProtectedResourceEndpointOptions);
    fetch(request: Request): Promise<Response>;
    close(): Promise<void>;
}
