import type { WorkOS } from '@workos-inc/node';
import type { JWTVerifyGetKey } from 'jose';
import type { LocalAuthPages } from './auth/local-auth/better-auth/local-auth-pages.ts';
import type { AccessResolver } from './auth/access-context.ts';
import type { WorkOSSettings } from './auth/hosted-auth/workos/workos-settings.ts';
import type { Billing } from './billing/billing.ts';
import type { DeploymentConfig } from './config/deployment-config.ts';
import { HostedAccountRoutes, type AccountFailureReporter, type AccountOperation } from './hosted-admin/account-routes.ts';
import { portalAccessOperation, PRODUCT_ACCESS } from './hosted-admin/portal-access.ts';
import type { BrowserSession } from './auth/hosted-auth/browser-session.ts';
import type { FetchHandler } from './http/server.ts';
import { MCPServer, type FailureReporter } from './mcp/mcp-server.ts';
import type { ChangeRecorder } from './organizations/change-records.ts';
import { OrganizationAdministration } from './organizations/organization-administration.ts';
import type { OrganizationDirectory } from './organizations/organization-directory.ts';

type Environment = Readonly<Record<string, string | undefined>>;

type SelfHostedConfig = Extract<DeploymentConfig, { deployment: 'self-hosted' }>;
type HostedConfig = Extract<DeploymentConfig, { deployment: 'hosted' }>;
type RouteConfig = Pick<DeploymentConfig, 'publicBaseUrl' | 'mcpResourceUrl' | 'resourceMetadataUrl'>;

export interface LocalRequestHandlers {
  readonly mcp: FetchHandler;
  readonly provider: FetchHandler;
  readonly pages: Pick<LocalAuthPages, 'handles' | 'handle'>;
}

// The browser routes of the provider that need no signed-in session: the sign-in, its callback, the sign-out, and the
// session of the portal. They come before the account routes, which need a signed-in session.
export interface BrowserRoutes {
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

// The connection to one WorkOS environment: its settings, an SDK client, and the AuthKit key set of the Connect
// tokens. The production connection reaches WorkOS; a test can point the client and the key set at a local fake.
export interface WorkOSConnection {
  readonly settings: WorkOSSettings;
  readonly workos: WorkOS;
  readonly authkitKeySet: JWTVerifyGetKey;
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
  close(): Promise<void>;
}

export interface ApplicationLogger {
  info(message: string): void;
  error(message: string): void;
}

// No retry and a short timeout: each WorkOS call runs during a browser or MCP request.
const WORKOS_REQUEST_TIMEOUT_MS = 5_000;

// The hosted provider reads its own settings from the environment, so no common setting turns it on.
export async function createApplication(config: DeploymentConfig, logger: ApplicationLogger, environment: Environment = {}): Promise<Application> {
  if (config.deployment === 'hosted') return createHostedApplication(config, logger, environment);
  return createSelfHostedApplication(config, logger);
}

export function operatorFailureReporter(logger: ApplicationLogger): FailureReporter {
  return ({ step, cause }) => logger.error(`An MCP request failed unexpectedly in ${step}: ${String(cause)}`);
}

async function createSelfHostedApplication(config: SelfHostedConfig, logger: ApplicationLogger): Promise<Application> {
  const { openBetterAuthRuntime } = await import('./auth/local-auth/better-auth/better-auth-runtime.ts');
  const { BetterAuthProvider } = await import('./auth/local-auth/better-auth/better-auth-provider.ts');
  const { LocalAuthPages, localPagePaths } = await import('./auth/local-auth/better-auth/local-auth-pages.ts');
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

// Invalid or missing WorkOS settings stop the start before the server listens. There is no fallback to local or
// anonymous access.
async function createHostedApplication(config: HostedConfig, logger: ApplicationLogger, environment: Environment): Promise<Application> {
  const { browserSessionIssuer, loadWorkOSSettings } = await import('./auth/hosted-auth/workos/workos-settings.ts');
  const settings = loadWorkOSSettings(environment, config.publicBaseUrl);
  const { WorkOS } = await import('@workos-inc/node');
  const { createRemoteJWKSet } = await import('jose');
  const workos = new WorkOS({
    apiKey: settings.apiKey,
    clientId: settings.clientId,
    issuer: browserSessionIssuer(settings.clientId),
    maxRetries: 0,
    timeout: WORKOS_REQUEST_TIMEOUT_MS,
  });
  const authkitKeySet = createRemoteJWKSet(new URL(`${settings.authkitIssuer}/oauth2/jwks`), { timeoutDuration: WORKOS_REQUEST_TIMEOUT_MS });
  logger.info(`Hosted authentication uses WorkOS: the client ${settings.clientId} and the AuthKit issuer ${settings.authkitIssuer}.`);
  return composeWorkOSApplication(config, { settings, workos, authkitKeySet }, logger);
}

export async function composeWorkOSApplication(config: RouteConfig, connection: WorkOSConnection, logger: ApplicationLogger): Promise<Application> {
  const { BillingFree } = await import('./billing/billing-free.ts');
  const parts = await workosProviderParts(config, connection, logger);
  return composeHostedApplication(config, parts, {
    reportFailure: accountFailureReporter(logger),
    changeRecords: accountChangeRecorder(logger),
    billing: new BillingFree(),
    operation: portalAccessOperation(config.publicBaseUrl),
  });
}

async function workosProviderParts(config: RouteConfig, connection: WorkOSConnection, logger: ApplicationLogger): Promise<HostedProviderParts> {
  const { WorkOSOrganizations } = await import('./auth/hosted-auth/workos/workos-organizations.ts');
  const { WorkOSAuthProvider } = await import('./auth/hosted-auth/workos/workos-auth-provider.ts');
  const { WorkOSBrowserSession } = await import('./auth/hosted-auth/workos/workos-browser-session.ts');
  const { WorkOSSessionRoutes } = await import('./auth/hosted-auth/workos/workos-session-routes.ts');
  const { workosAuthority } = await import('./auth/hosted-auth/workos/workos-settings.ts');
  const { UnavailableHostedAuthentication } = await import('./auth/hosted-auth/unavailable-hosted-authentication.ts');
  const { ProtectedResourceEndpoint } = await import('./mcp/protected-resource-endpoint.ts');
  const { settings, workos, authkitKeySet } = connection;
  const authority = workosAuthority(settings.clientId);
  const grants = new WorkOSOrganizations({ userManagement: workos.userManagement, authorization: workos.authorization });
  const provider = new WorkOSAuthProvider({ authority, authkitIssuer: settings.authkitIssuer, mcpResourceUrl: config.mcpResourceUrl, keySet: authkitKeySet, grants });
  const session = new WorkOSBrowserSession({ workos, settings, authority });
  const server = new MCPServer({
    auth: { verifier: provider, accessResolver: provider, resourceMetadataUrl: config.resourceMetadataUrl, expectedResource: new URL(config.mcpResourceUrl), requiredPermission: PRODUCT_ACCESS },
    reportFailure: operatorFailureReporter(logger),
  });
  const mcp = new ProtectedResourceEndpoint({ server, mcpResourceUrl: config.mcpResourceUrl, resourceMetadataUrl: config.resourceMetadataUrl, authorizationServer: settings.authkitIssuer });
  const browserRoutes = new WorkOSSessionRoutes({ session, publicBaseUrl: config.publicBaseUrl, redirectUri: settings.redirectUri, reportFailure: accountFailureReporter(logger) });
  // AUTH-07W replaces this organization directory with the WorkOS organization reads. Until then the organization
  // page shows the onboarding guidance, and the selection and the administration pages give no access.
  return { session, accessResolver: provider, organizations: new UnavailableHostedAuthentication(), mcp, browserRoutes };
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
    organizations: new OrganizationAdministration({ directory: parts.organizations, records: account.changeRecords, billing: account.billing }),
    reportFailure: account.reportFailure,
    operation: account.operation,
  });
  const handle = routeHostedRequests(config, { mcp: (request) => parts.mcp.fetch(request), account: (request) => routes.handle(request), browser: parts.browserRoutes });
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
    if (handlers.browser?.handles(pathname)) return handlers.browser.handle(request);
    if (pathname.startsWith(basePath)) return handlers.account(request);
    return new Response('Not Found', { status: 404 });
  };
}

function applicationRecord(handle: Application['handle'], owned: AsyncDisposableStack): Application {
  let closing: Promise<void> | undefined;
  return Object.freeze({ handle, close: () => closing ??= owned.disposeAsync() });
}
