import type { LocalAuthPages } from './auth/local-auth/better-auth/local-auth-pages.ts';
import type { AccessResolver } from './auth/access-context.ts';
import type { Billing } from './billing/billing.ts';
import type { DeploymentConfig } from './config/deployment-config.ts';
import { HostedAccountRoutes, type AccountFailureReporter, type AccountOperation } from './hosted-admin/account-routes.ts';
import type { BrowserSession } from './auth/hosted-auth/browser-session.ts';
import type { FetchHandler } from './http/server.ts';
import { MCPServer, type FailureReporter } from './mcp/mcp-server.ts';
import type { ChangeRecorder } from './organizations/change-records.ts';
import { OrganizationAdministration } from './organizations/organization-administration.ts';
import type { OrganizationDirectory } from './organizations/organization-directory.ts';

// The settings that only the server reads, such as AD_RULES_FILE and the WorkOS settings. The local commands share
// DeploymentConfig.
type Environment = Readonly<Record<string, string | undefined>>;

type SelfHostedConfig = Extract<DeploymentConfig, { deployment: 'self-hosted' }>;
type HostedConfig = Extract<DeploymentConfig, { deployment: 'hosted' }>;
export type RouteConfig = Pick<DeploymentConfig, 'publicBaseUrl' | 'mcpResourceUrl' | 'resourceMetadataUrl'>;

export interface LocalRequestHandlers {
  readonly mcp: FetchHandler;
  readonly provider: FetchHandler;
  readonly pages: Pick<LocalAuthPages, 'handles' | 'handle'>;
}

// The browser routes of the provider that need no signed-in session: the sign-in, its callback, the sign-out, and the
// session of the portal. They come before the account routes, which need a signed-in session.
interface BrowserRoutes {
  handles(pathname: string): boolean;
  handle(request: Request): Promise<Response>;
}

export interface HostedRequestHandlers {
  readonly mcp: FetchHandler;
  readonly account: FetchHandler;
  readonly browser?: BrowserRoutes;
}

// The parts that change with the hosted provider. The MCP endpoint answers the MCP resource and its
// protected-resource metadata, and the application closes it.
export interface HostedProviderParts {
  readonly session: BrowserSession;
  readonly accessResolver: AccessResolver;
  readonly organizations: OrganizationDirectory;
  readonly mcp: Pick<MCPServer, 'fetch' | 'close'>;
  readonly browserRoutes?: BrowserRoutes;
}

export interface HostedAccountParts {
  readonly reportFailure: AccountFailureReporter;
  // Keeps the basic records of the privileged account changes.
  readonly changeRecords: ChangeRecorder;
  // The one billing of the hosted organizations: BillingFree until a payment provider implementation replaces it.
  readonly billing: Billing;
  readonly operation?: AccountOperation;
}

export interface Application {
  handle(request: Request): Promise<Response>;
  close(listenerDrain?: Promise<void>): Promise<void>;
}

export interface ApplicationLogger {
  info(message: string): void;
  error(message: string): void;
}

// The hosted provider reads its own settings from the environment, so no common setting turns it on.
export async function createApplication(config: DeploymentConfig, logger: ApplicationLogger, environment: Environment): Promise<Application> {
  if (config.deployment === 'hosted') return createHostedApplication(config, logger, environment);
  return createSelfHostedApplication(config, logger, environment);
}

export function operatorFailureReporter(logger: ApplicationLogger): FailureReporter {
  return ({ step, cause }) => logger.error(`An MCP request failed unexpectedly in ${step}: ${String(cause)}`);
}

async function createSelfHostedApplication(config: SelfHostedConfig, logger: ApplicationLogger, environment: Environment): Promise<Application> {
  // The rules load before the data directory opens, so a rules failure holds no resource and changes no data.
  const { createFetchOperation, fetchToolServers } = await import('./fetch-tool.ts');
  const buildServer = fetchToolServers(createFetchOperation(environment, logger), logger);
  const { openBetterAuthRuntime } = await import('./auth/local-auth/better-auth/better-auth-runtime.ts');
  const { BetterAuthProvider } = await import('./auth/local-auth/better-auth/better-auth-provider.ts');
  const { LocalAuthPages, localPagePaths } = await import('./auth/local-auth/better-auth/local-auth-pages.ts');
  await using owned = new AsyncDisposableStack();
  await using requestResources = new AsyncDisposableStack();
  const runtime = owned.adopt(await openBetterAuthRuntime(config), (opened) => opened.close());
  const issuer = new URL('api/auth', config.publicBaseUrl).href;
  const provider = new BetterAuthProvider(runtime.auth, {
    issuer,
    mcpResourceUrl: config.mcpResourceUrl,
    installationId: runtime.installationId,
    resourceServerClient: runtime.resourceServerClient.current(),
  });
  const pages = new LocalAuthPages(runtime.auth.handler, { issuer, paths: localPagePaths(config.publicBaseUrl) });
  const mcp = requestResources.adopt(new MCPServer({
    auth: {
      verifier: provider,
      accessResolver: provider,
      resourceMetadataUrl: config.resourceMetadataUrl,
      expectedResource: new URL(config.mcpResourceUrl),
    },
    buildServer,
    reportFailure: operatorFailureReporter(logger),
  }), (server) => server.close());
  logger.info(`The self-hosted installation uses tenant ${runtime.tenantId}.`);
  const handle = routeLocalRequests(config, { mcp: (request) => mcp.fetch(request), provider: runtime.auth.handler, pages });
  const requests = requestResources.move();
  return composeApplication(handle, { close: () => requests.disposeAsync() }, owned.move());
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

// The hosted edition loads its provider only here, as the self-hosted edition does.
async function createHostedApplication(config: HostedConfig, logger: ApplicationLogger, environment: Environment): Promise<Application> {
  const { openWorkOSApplication } = await import('./hosted-workos-application.ts');
  return openWorkOSApplication(config, logger, environment);
}

export function accountFailureReporter(logger: ApplicationLogger): AccountFailureReporter {
  return ({ path, cause }) => logger.error(`An account request failed unexpectedly for ${path}: ${String(cause)}`);
}

// The operator log keeps the change records until hosted storage exists. JSON keeps each record on one line.
export function accountChangeRecorder(logger: ApplicationLogger): ChangeRecorder {
  return { record: (entry) => logger.info(`Account change record: ${JSON.stringify(entry)}`) };
}

export function composeHostedApplication(config: RouteConfig, parts: HostedProviderParts, account: HostedAccountParts): Application {
  const routes = new HostedAccountRoutes({
    publicBaseUrl: config.publicBaseUrl,
    session: parts.session,
    accessResolver: parts.accessResolver,
    organizations: new OrganizationAdministration({ directory: parts.organizations, records: account.changeRecords, billing: account.billing }),
    reportFailure: account.reportFailure,
    operation: account.operation,
  });
  const handle = routeHostedRequests(config, { mcp: (request) => parts.mcp.fetch(request), account: (request) => routes.handle(request), browser: parts.browserRoutes });
  const shutdown = new AbortController();
  return composeApplication((request) => {
    const signal = AbortSignal.any([request.signal, shutdown.signal]);
    signal.throwIfAborted();
    return handle(new Request(request, { signal }));
  }, { close: () => {
    shutdown.abort(new DOMException('The hosted application is shutting down', 'AbortError'));
    return parts.mcp.close();
  } });
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
    if (handlers.browser?.handles(pathname)) return handlers.browser.handle(request);
    if (pathname.startsWith(basePath)) return handlers.account(request);
    return new Response('Not Found', { status: 404 });
  };
}

export function composeApplication(handle: Application['handle'], mcp: Pick<MCPServer, 'close'>, providerResources = new AsyncDisposableStack()): Application {
  const owned = new AsyncDisposableStack();
  owned.use(providerResources);
  let drained = Promise.resolve<PromiseSettledResult<void>>({ status: 'fulfilled', value: undefined });
  owned.defer(async () => {
    const result = await drained;
    if (result.status === 'rejected') throw result.reason;
  });
  owned.defer(() => mcp.close());
  let closing: Promise<void> | undefined;
  return Object.freeze({ handle, close: (listenerDrain?: Promise<void>) => {
    if (closing === undefined) {
      // Observe drain failures now, even when MCP cleanup takes longer than listener cleanup.
      drained = (listenerDrain ?? Promise.resolve()).then(
        (value) => ({ status: 'fulfilled', value }),
        (reason: unknown) => ({ status: 'rejected', reason }),
      );
      closing = owned.disposeAsync();
    }
    return closing;
  } });
}
