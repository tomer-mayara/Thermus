import type { SystemLog } from '../logs/system/system-logger.ts';
import { AuditLog } from '../logs/audit/audit-log.ts';
import type { LocalAuthPages } from '../interfaces/web/auth/better-auth/local-auth-pages.ts';
import type { AccessResolver } from '../accounts/identity/access-context.ts';
import type { Billing } from '../accounts/billing/billing.ts';
import type { DeploymentConfig } from '../runtime/config/deployment-config.ts';
import { HostedAccountRoutes, type AccountFailureReporter, type AccountOperation, type HostedAccountRoutesOptions } from '../interfaces/web/account/account-routes.ts';
import type { BrowserSession } from '../accounts/identity/browser-session.ts';
import type { FetchHandler } from '../runtime/http/server.ts';
import { MCPServer, type FailureReporter } from '../interfaces/mcp/mcp-server.ts';
import type { ChangeRecorder } from '../accounts/organizations/change-records.ts';
import { OrganizationAdministration } from '../accounts/organizations/organization-administration.ts';
import type { OrganizationDirectory } from '../accounts/organizations/organization-directory.ts';
import type { RemovalOperationStore } from '../accounts/organizations/removal-operation-store.ts';

type Environment = Readonly<Record<string, string | undefined>>;

type SelfHostedConfig = Extract<DeploymentConfig, { deployment: 'self-hosted' }>;
type HostedConfig = Extract<DeploymentConfig, { deployment: 'hosted' }>;
export type RouteConfig = Pick<DeploymentConfig, 'publicBaseUrl' | 'mcpResourceUrl' | 'resourceMetadataUrl'>;

export interface LocalRequestHandlers {
  readonly mcp: FetchHandler;
  readonly provider: FetchHandler;
  readonly pages: Pick<LocalAuthPages, 'handles' | 'handle'>;
}

// A group of routes that answers the paths it handles. The browser routes of the provider need no signed-in session:
// the sign-in, its callback, the sign-out, and the session of the portal. The internal routes answer the private
// network only. Both come before the account routes, which need a signed-in session.
interface RouteGroup {
  handles(pathname: string): boolean;
  handle(request: Request): Promise<Response>;
}

export interface HostedRequestHandlers {
  readonly mcp: FetchHandler;
  readonly account: FetchHandler;
  readonly browser?: RouteGroup;
  readonly internal?: RouteGroup;
}

export interface HostedProviderParts {
  readonly session: BrowserSession;
  readonly accessResolver: AccessResolver;
  readonly organizations: OrganizationDirectory;
  readonly mcp: Pick<MCPServer, 'fetch' | 'close'>;
  readonly browserRoutes?: RouteGroup;
  readonly internalRoutes?: RouteGroup;
}

export interface HostedAccountParts {
  readonly reportFailure: AccountFailureReporter;
  readonly changeRecords: ChangeRecorder;
  readonly audit?: Pick<AuditLog, 'administrationChanged' | 'destinationChanged'>;
  readonly billing: Billing;
  readonly operation?: AccountOperation;
  readonly signupUrl?: string;
}

export interface Application {
  handle(request: Request): Promise<Response>;
  close(listenerDrain?: Promise<void>): Promise<void>;
}

// The hosted provider reads its own settings from the environment, so no common setting turns it on.
export async function createApplication(config: DeploymentConfig, logger: SystemLog, environment: Environment): Promise<Application> {
  if (config.deployment === 'hosted') return createHostedApplication(config, logger, environment);
  return createSelfHostedApplication(config, logger, environment);
}

export function operatorFailureReporter(logger: SystemLog): FailureReporter {
  return ({ step, cause }) => logger.error(`An MCP request failed unexpectedly in ${step}: ${String(cause)}`);
}

async function createSelfHostedApplication(config: SelfHostedConfig, logger: SystemLog, environment: Environment): Promise<Application> {
  // The rules load before the data directory opens, so a rules failure holds no resource and changes no data.
  const { createToolOperations, fetchToolServers } = await import('./fetch-tool.ts');
  const buildServer = fetchToolServers(createToolOperations(environment, logger), logger, discardAuditLog());
  const { openBetterAuthRuntime } = await import('../accounts/providers/better-auth/better-auth-runtime.ts');
  const { BetterAuthProvider } = await import('../accounts/providers/better-auth/better-auth-provider.ts');
  const { LocalAuthPages, localPagePaths } = await import('../interfaces/web/auth/better-auth/local-auth-pages.ts');
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

// The hosted edition loads its provider only here, as the self-hosted edition does. THERMUS_ROLE selects the role of
// the hosted image: the control plane, or a tenant that serves the tools of one organization.
async function createHostedApplication(config: HostedConfig, logger: SystemLog, environment: Environment): Promise<Application> {
  if (config.role === 'tenant') {
    const { openTenantApplication } = await import('./tenant-application.ts');
    return openTenantApplication(config, logger, environment);
  }
  const { openWorkOSApplication } = await import('./hosted-workos-application.ts');
  return openWorkOSApplication(config, logger, environment);
}

export function accessDeniedDescription(publicBaseUrl: string): string {
  return `Access denied. Open ${new URL('signup', publicBaseUrl).href} to check free signup availability. If you already have access, reauthorize this MCP client and choose the intended workspace.`;
}

export function accountFailureReporter(logger: SystemLog): AccountFailureReporter {
  return ({ path, cause }) => logger.error(`An account request failed unexpectedly for ${path}: ${String(cause)}`);
}

// These privileged changes are internal system diagnostics only. JSON keeps each record on one line.
export function accountChangeRecorder(logger: SystemLog): ChangeRecorder {
  return { record: (entry) => logger.info(`Account change record: ${JSON.stringify(entry)}`) };
}

export function discardAuditLog(): AuditLog {
  return new AuditLog({ writeAuditEvent: () => {} });
}

export function composeHostedApplication(config: RouteConfig, parts: HostedProviderParts, account: HostedAccountParts, loggingStorage?: { close(): Promise<void>; readonly service?: HostedAccountRoutesOptions['logging']; readonly removalStore?: RemovalOperationStore }): Application {
  const administration = new OrganizationAdministration({ directory: parts.organizations, records: account.changeRecords, billing: account.billing, removalStore: loggingStorage?.removalStore });
  const routes = new HostedAccountRoutes({
    publicBaseUrl: config.publicBaseUrl,
    mcpResourceUrl: config.mcpResourceUrl,
    session: parts.session,
    accessResolver: parts.accessResolver,
    organizations: administration,
    reportFailure: account.reportFailure,
    operation: account.operation,
    signupUrl: account.signupUrl,
    logging: loggingStorage?.service,
    audit: account.audit,
  });
  const handle = routeHostedRequests(config, { mcp: (request) => parts.mcp.fetch(request), account: (request) => routes.handle(request), browser: parts.browserRoutes, internal: parts.internalRoutes });
  const shutdown = new AbortController();
  return composeApplication((request) => {
    const signal = AbortSignal.any([request.signal, shutdown.signal]);
    signal.throwIfAborted();
    return handle(new Request(request, { signal }));
  }, { close: () => {
    shutdown.abort(new DOMException('The hosted application is shutting down', 'AbortError'));
    const closing = [(async () => parts.mcp.close())(), (async () => {
      // Stop new removal work before the shared SQL runtime closes.
      try { await administration.close(); } finally { await loggingStorage?.close(); }
    })()];
    return Promise.allSettled(closing).then((results) => {
      const failures = results.filter((result) => result.status === 'rejected').map((result) => result.reason);
      if (failures.length > 0) throw new AggregateError(failures, 'Hosted application cleanup failed.');
    });
  } });
}

export function routeHostedRequests(config: RouteConfig, handlers: HostedRequestHandlers): FetchHandler {
  const publicUrl = new URL(config.publicBaseUrl);
  const basePath = publicUrl.pathname;
  const mcpPath = new URL(config.mcpResourceUrl).pathname;
  const mcpPaths = new Set([
    mcpPath,
    '/.well-known/oauth-protected-resource',
    new URL(config.resourceMetadataUrl).pathname,
  ]);
  return async (request) => {
    const pathname = new URL(request.url).pathname;
    if (pathname === mcpPath) {
      const origin = request.headers.get('Origin');
      if (origin !== null && origin !== publicUrl.origin) return new Response('Forbidden', { status: 403 });
    }
    if (mcpPaths.has(pathname)) return handlers.mcp(request);
    if (handlers.internal?.handles(pathname)) return handlers.internal.handle(request);
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
