import type { LocalAuthPages } from './auth-better-auth/local-auth-pages.ts';
import type { AccessResolver } from './auth/access-context.ts';
import type { DeploymentConfig } from './config/deployment-config.ts';
import { HostedAccountRoutes, type AccountOperation } from './hosted-admin/account-routes.ts';
import type { BrowserSession } from './hosted-admin/browser-session.ts';
import type { FetchHandler } from './http/server.ts';
import { MCPServer, type FailureReporter } from './mcp/mcp-server.ts';

type SelfHostedConfig = Extract<DeploymentConfig, { deployment: 'self-hosted' }>;
type HostedConfig = Extract<DeploymentConfig, { deployment: 'hosted' }>;
type RouteConfig = Pick<DeploymentConfig, 'publicBaseUrl' | 'mcpResourceUrl' | 'resourceMetadataUrl'>;

export interface LocalRequestHandlers {
  readonly mcp: FetchHandler;
  readonly provider: FetchHandler;
  readonly pages: Pick<LocalAuthPages, 'handles' | 'handle'>;
}

export interface HostedRequestHandlers {
  readonly mcp: FetchHandler;
  readonly account: FetchHandler;
}

// The provider roles that the hosted composition uses. The unavailable placeholder implements them now. The hosted
// WorkOS provider implements the same roles when it replaces the placeholder.
export interface HostedAuthentication {
  readonly session: BrowserSession;
  readonly accessResolver: AccessResolver;
}

export interface Application {
  handle(request: Request): Promise<Response>;
  close(): Promise<void>;
}

export interface ApplicationLogger {
  info(message: string): void;
  error(message: string): void;
}

export async function createApplication(config: DeploymentConfig, logger: ApplicationLogger): Promise<Application> {
  if (config.deployment === 'hosted') return createHostedApplication(config, logger);
  return createSelfHostedApplication(config, logger);
}

export function operatorFailureReporter(logger: ApplicationLogger): FailureReporter {
  return ({ step, cause }) => logger.error(`An MCP request failed unexpectedly in ${step}: ${String(cause)}`);
}

async function createSelfHostedApplication(config: SelfHostedConfig, logger: ApplicationLogger): Promise<Application> {
  const { openBetterAuthRuntime } = await import('./auth-better-auth/better-auth-runtime.ts');
  const { BetterAuthProvider } = await import('./auth-better-auth/better-auth-provider.ts');
  const { LocalAuthPages, localPagePaths } = await import('./auth-better-auth/local-auth-pages.ts');
  await using owned = new AsyncDisposableStack();
  const runtime = owned.adopt(await openBetterAuthRuntime(config), (opened) => opened.close());
  const issuer = new URL('api/auth', config.publicBaseUrl).href;
  const provider = new BetterAuthProvider(runtime.auth, {
    issuer,
    mcpResourceUrl: config.mcpResourceUrl,
    installationId: runtime.installationId,
    resourceServerClient: runtime.resourceServerClient.current(),
  });
  const pages = new LocalAuthPages(runtime.auth.handler, { issuer, paths: localPagePaths(config.publicBaseUrl) });
  const mcp = owned.adopt(new MCPServer({
    auth: {
      verifier: provider,
      accessResolver: provider,
      resourceMetadataUrl: config.resourceMetadataUrl,
      expectedResource: new URL(config.mcpResourceUrl),
    },
    reportFailure: operatorFailureReporter(logger),
  }), (server) => server.close());
  logger.info(`The self-hosted installation uses tenant ${runtime.tenantId}.`);
  const handle = routeLocalRequests(config, { mcp: (request) => mcp.fetch(request), provider: runtime.auth.handler, pages });
  return applicationRecord(handle, owned.move());
}

// Only these public paths reach the provider. Its browser and administration APIs stay private.
export function routeLocalRequests(config: RouteConfig, handlers: LocalRequestHandlers): FetchHandler {
  const mcpPath = new URL(config.mcpResourceUrl).pathname;
  const authPath = new URL('api/auth', config.publicBaseUrl).pathname;
  const providerPaths = new Set([
    '/.well-known/oauth-protected-resource',
    new URL(config.resourceMetadataUrl).pathname,
    `/.well-known/oauth-authorization-server${authPath}`,
    `${authPath}/.well-known/openid-configuration`,
    `${authPath}/oauth2/authorize`,
    `${authPath}/oauth2/token`,
  ]);
  return async (request) => {
    const pathname = new URL(request.url).pathname;
    if (pathname === mcpPath) return handlers.mcp(request);
    if (providerPaths.has(pathname)) return handlers.provider(request);
    if (handlers.pages.handles(pathname)) return handlers.pages.handle(request);
    return new Response('Not Found', { status: 404 });
  };
}

async function createHostedApplication(config: HostedConfig, logger: ApplicationLogger): Promise<Application> {
  const { UnavailableHostedAuthentication } = await import('./auth-unavailable/unavailable-hosted-authentication.ts');
  const authentication = new UnavailableHostedAuthentication();
  logger.info('Hosted authentication is not available yet. Each hosted request gets the authentication-unavailable notice.');
  return composeHostedApplication(config, { session: authentication, accessResolver: authentication });
}

// The hosted composition owns no resource yet. The MCP resource has no hosted verifier yet, so each MCP request,
// also one without a credential, gets the unavailable answer and no Bearer challenge.
export function composeHostedApplication(config: RouteConfig, authentication: HostedAuthentication, operation?: AccountOperation): Application {
  const account = new HostedAccountRoutes({ ...authentication, operation });
  const handle = routeHostedRequests(config, { mcp: async () => mcpAuthenticationUnavailable(), account: (request) => account.handle(request) });
  return applicationRecord(handle, new AsyncDisposableStack());
}

// The MCP resource and its metadata go to the MCP handler. Each other path under the public URL is a browser path.
export function routeHostedRequests(config: RouteConfig, handlers: HostedRequestHandlers): FetchHandler {
  const basePath = new URL(config.publicBaseUrl).pathname;
  const mcpPaths = new Set([
    new URL(config.mcpResourceUrl).pathname,
    '/.well-known/oauth-protected-resource',
    new URL(config.resourceMetadataUrl).pathname,
  ]);
  return async (request) => {
    const pathname = new URL(request.url).pathname;
    if (mcpPaths.has(pathname)) return handlers.mcp(request);
    if (pathname.startsWith(basePath)) return handlers.account(request);
    return new Response('Not Found', { status: 404 });
  };
}

function mcpAuthenticationUnavailable(): Response {
  const body = { error: 'temporarily_unavailable', error_description: 'Hosted authentication is not available yet.' };
  return Response.json(body, { status: 503, headers: { 'Cache-Control': 'no-store' } });
}

function applicationRecord(handle: Application['handle'], owned: AsyncDisposableStack): Application {
  let closing: Promise<void> | undefined;
  return Object.freeze({ handle, close: () => closing ??= owned.disposeAsync() });
}
