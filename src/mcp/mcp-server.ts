import {
  bearerAuthChallengeResponse,
  createMcpHandler,
  McpServer,
  OAuthError,
  OAuthErrorCode,
  requireBearerAuth,
  type Transport,
} from '@modelcontextprotocol/server';
import { serveStdio, type StdioServerHandle } from '@modelcontextprotocol/server/stdio';

import type { IdentityVerifier } from './identity-verifier.ts';
import { IdentityVerifierSdkAdapter } from './identity-verifier-sdk-adapter.ts';

export class MCPServer {
  private connection?: StdioServerHandle;
  private readonly httpHandler = createMcpHandler(
    () => new McpServer({ name: 'magumagu', version: '0.0.0' }),
  );
  private readonly authenticate?: ReturnType<typeof requireBearerAuth>;

  constructor(options?: {
    auth: {
      verifier: IdentityVerifier;
      resourceMetadataUrl: string;
      expectedResource?: URL;
      requiredScopes?: readonly string[];
    };
  }) {
    if (options !== undefined) {
      const authOptions = {
        verifier: new IdentityVerifierSdkAdapter(options.auth.verifier),
        resourceMetadataUrl: options.auth.resourceMetadataUrl,
        expectedResource: options.auth.expectedResource,
        requiredScopes: options.auth.requiredScopes === undefined ? undefined : [...options.auth.requiredScopes],
      };
      const authenticate = requireBearerAuth(authOptions);
      this.authenticate = async (request) => {
        const authorization = request.headers.get('Authorization');
        if (authorization !== null && !/^Bearer [^\s,]+$/i.test(authorization)) {
          return bearerAuthChallengeResponse(
            new OAuthError(OAuthErrorCode.InvalidToken, "Invalid Authorization header format, expected 'Bearer TOKEN'"),
            authOptions,
          );
        }
        return authenticate(request);
      };
    }
  }

  connect(transport: Transport): void {
    this.connection = serveStdio(
      () => new McpServer({ name: 'magumagu', version: '0.0.0' }),
      { transport },
    );
  }

  async fetch(request: Request): Promise<Response> {
    if (this.authenticate === undefined) {
      throw new Error('HTTP authentication must be configured before serving requests');
    }
    const authInfo = await this.authenticate(request);
    if (authInfo instanceof Response) return authInfo;
    return this.httpHandler.fetch(request, { authInfo });
  }

  async close(): Promise<void> {
    await Promise.all([this.httpHandler.close(), this.connection?.close()]);
  }
}
