import { buildOAuthProtectedResourceMetadata, type OAuthMetadata, type OAuthProtectedResourceMetadata } from '@modelcontextprotocol/server';
import type { MCPServer } from './mcp-server.ts';

export interface ProtectedResourceEndpointOptions {
  readonly server: Pick<MCPServer, 'fetch' | 'close'>;
  readonly mcpResourceUrl: string;
  // The metadata URL that the Bearer challenges of the MCP server name.
  readonly resourceMetadataUrl: string;
  // The issuer of the authorization server of the MCP resource, such as the AuthKit domain.
  readonly authorizationServer: string;
}

const ROOT_METADATA_PATH = '/.well-known/oauth-protected-resource';
const METADATA_METHODS = 'GET, HEAD';

// The hosted MCP resource and its RFC 9728 protected-resource metadata, which sends MCP clients to the authorization
// server. The metadata is made with the endpoint, so an issuer that is not valid stops the start.
export class ProtectedResourceEndpoint {
  private readonly server: Pick<MCPServer, 'fetch' | 'close'>;
  private readonly metadataPaths: ReadonlySet<string>;
  private readonly metadata: OAuthProtectedResourceMetadata;

  constructor(options: ProtectedResourceEndpointOptions) {
    this.server = options.server;
    this.metadataPaths = new Set([ROOT_METADATA_PATH, new URL(options.resourceMetadataUrl).pathname]);
    this.metadata = buildOAuthProtectedResourceMetadata({
      oauthMetadata: authorizationServerMetadata(options.authorizationServer),
      resourceServerUrl: new URL(options.mcpResourceUrl),
    });
  }

  async fetch(request: Request): Promise<Response> {
    if (!this.metadataPaths.has(new URL(request.url).pathname)) return this.server.fetch(request);
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405, headers: { Allow: METADATA_METHODS } });
    const response = Response.json(this.metadata);
    return request.method === 'HEAD' ? new Response(null, { status: response.status, headers: response.headers }) : response;
  }

  async close(): Promise<void> {
    await this.server.close();
  }
}

// The metadata helper uses only the issuer. Its type also needs these fields, which give the AuthKit endpoints.
function authorizationServerMetadata(issuer: string): OAuthMetadata {
  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth2/authorize`,
    token_endpoint: `${issuer}/oauth2/token`,
    response_types_supported: ['code'],
  };
}
