import type { AccessResolver } from './auth/access-context.ts';
import type { DeploymentConfig } from './config/deployment-config.ts';
import { InvalidAccessTokenError, type IdentityVerifier } from './mcp/identity-verifier.ts';
import { MCPServer } from './mcp/mcp-server.ts';

type SelfHostedConfig = Extract<DeploymentConfig, { deployment: 'self-hosted' }>;

export interface Application {
  handle(request: Request): Promise<Response>;
  close(): Promise<void>;
}

export interface ApplicationLogger {
  info(message: string): void;
}

export class HostedEditionUnavailableError extends Error {
  constructor() {
    super('The hosted edition is not available in this version of Magumagu.');
    this.name = 'HostedEditionUnavailableError';
  }
}

// MCP token introspection needs the resource-server client that the local
// auth command registers. Until that exists, the MCP endpoint accepts no token.
const acceptsNoAccessToken: IdentityVerifier = {
  verifyAccessToken: async () => {
    throw new InvalidAccessTokenError('The self-hosted edition accepts no MCP access token yet');
  },
};

const deniesEveryUser: AccessResolver = {
  resolve: async () => ({ allowed: false, reason: 'account-inactive' }),
};

export async function createApplication(config: DeploymentConfig, logger: ApplicationLogger): Promise<Application> {
  if (config.deployment === 'hosted') throw new HostedEditionUnavailableError();
  return createSelfHostedApplication(config, logger);
}

async function createSelfHostedApplication(config: SelfHostedConfig, logger: ApplicationLogger): Promise<Application> {
  const { openBetterAuthRuntime } = await import('./auth-better-auth/better-auth-runtime.ts');
  await using owned = new AsyncDisposableStack();
  const runtime = owned.adopt(await openBetterAuthRuntime(config), (opened) => opened.close());
  const mcp = owned.adopt(new MCPServer({
    auth: {
      verifier: acceptsNoAccessToken,
      accessResolver: deniesEveryUser,
      resourceMetadataUrl: config.resourceMetadataUrl,
      expectedResource: new URL(config.mcpResourceUrl),
    },
  }), (server) => server.close());
  logger.info(`The self-hosted installation uses tenant ${runtime.tenantId}.`);
  return applicationRecord(routeRequests(new URL(config.mcpResourceUrl).pathname, mcp), owned.move());
}

function routeRequests(mcpPath: string, mcp: MCPServer): Application['handle'] {
  return async (request) => {
    if (new URL(request.url).pathname === mcpPath) return mcp.fetch(request);
    return new Response('Not Found', { status: 404 });
  };
}

function applicationRecord(handle: Application['handle'], owned: AsyncDisposableStack): Application {
  let closing: Promise<void> | undefined;
  return Object.freeze({ handle, close: () => closing ??= owned.disposeAsync() });
}
