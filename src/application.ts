import type { LocalAuthPages } from './auth-better-auth/local-auth-pages.ts';
import type { AccessResolver } from './auth/access-context.ts';
import type { DeploymentConfig } from './config/deployment-config.ts';
import { HostedAccountRoutes, type AccountFailureReporter, type AccountOperation } from './hosted-admin/account-routes.ts';
import type { BrowserSession } from './hosted-admin/browser-session.ts';
import type { FetchHandler } from './http/server.ts';
import { MCPServer, type FailureReporter } from './mcp/mcp-server.ts';
import { OrganizationAdministration, type ChangeRecorder, type OrganizationDirectory } from './organizations/organization-administration.ts';

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

// The parts that change when the hosted WorkOS provider replaces the unavailable placeholder. The MCP endpoint
// answers the MCP resource and its protected-resource metadata, and the application closes it.
export interface HostedProviderParts {
  readonly session: BrowserSession;
  readonly accessResolver: AccessResolver;
  readonly organizations: OrganizationDirectory;
  readonly mcp: Pick<MCPServer, 'fetch' | 'close'>;
}

export interface HostedAccountParts {
  readonly reportFailure: AccountFailureReporter;
  // Keeps the basic records of the privileged account changes.
  readonly changeRecords: ChangeRecorder;
  readonly operation?: AccountOperation;
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
  const { UnavailableHostedAuthentication, UnavailableMcpEndpoint } = await import('./auth-unavailable/unavailable-hosted-authentication.ts');
  const authentication = new UnavailableHostedAuthentication();
  logger.info('Hosted authentication is not available yet. Each hosted request gets the authentication-unavailable notice.');
  const parts = { session: authentication, accessResolver: authentication, organizations: authentication, mcp: new UnavailableMcpEndpoint() };
  return composeHostedApplication(config, parts, { reportFailure: accountFailureReporter(logger), changeRecords: accountChangeRecorder(logger) });
}

export function accountFailureReporter(logger: ApplicationLogger): AccountFailureReporter {
  return ({ path, cause }) => logger.error(`An account request failed unexpectedly for ${path}: ${String(cause)}`);
}

// The operator log keeps the change records until hosted storage exists. JSON keeps each record on one line.
export function accountChangeRecorder(logger: ApplicationLogger): ChangeRecorder {
  return { record: (entry) => logger.info(`Account change record: ${JSON.stringify(entry)}`) };
}

export function composeHostedApplication(config: RouteConfig, parts: HostedProviderParts, account: HostedAccountParts): Application {
  const owned = new AsyncDisposableStack();
  owned.defer(() => parts.mcp.close());
  const routes = new HostedAccountRoutes({
    publicBaseUrl: config.publicBaseUrl,
    session: parts.session,
    accessResolver: parts.accessResolver,
    organizations: new OrganizationAdministration({ directory: parts.organizations, records: account.changeRecords }),
    reportFailure: account.reportFailure,
    operation: account.operation,
  });
  const handle = routeHostedRequests(config, { mcp: (request) => parts.mcp.fetch(request), account: (request) => routes.handle(request) });
  return applicationRecord(handle, owned);
}

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

function applicationRecord(handle: Application['handle'], owned: AsyncDisposableStack): Application {
  let closing: Promise<void> | undefined;
  return Object.freeze({ handle, close: () => closing ??= owned.disposeAsync() });
}
