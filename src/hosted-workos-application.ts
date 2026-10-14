import type { WorkOS } from '@workos-inc/node';
import type { JWTVerifyGetKey } from 'jose';
import {
  accountChangeRecorder,
  accountFailureReporter,
  composeHostedApplication,
  operatorFailureReporter,
  type Application,
  type ApplicationLogger,
  type HostedProviderParts,
  type RouteConfig,
} from './application.ts';
import type { WorkOSSettings } from './auth/hosted-auth/workos/workos-settings.ts';
import { portalAccessOperation, PRODUCT_ACCESS } from './hosted-admin/portal-access.ts';
import { MCPServer } from './mcp/mcp-server.ts';

type Environment = Readonly<Record<string, string | undefined>>;

// The connection to one WorkOS environment: its settings, an SDK client, and the AuthKit key set of the Connect
// tokens. The production connection reaches WorkOS; a test can point the client and the key set at a local fake.
export interface WorkOSConnection {
  readonly settings: WorkOSSettings;
  readonly workos: WorkOS;
  readonly authkitKeySet: JWTVerifyGetKey;
}

// No retry and a short timeout: each WorkOS call runs during a browser or MCP request.
const WORKOS_REQUEST_TIMEOUT_MS = 5_000;

// Invalid or missing WorkOS settings stop the start before the server listens. There is no fallback to local or
// anonymous access.
export async function openWorkOSApplication(config: RouteConfig, logger: ApplicationLogger, environment: Environment): Promise<Application> {
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
  const { ProtectedResourceEndpoint } = await import('./mcp/protected-resource-endpoint.ts');
  const { settings, workos, authkitKeySet } = connection;
  const authority = workosAuthority(settings.clientId);
  // One directory gives the current grants to access resolution and the organizations to the account routes.
  const organizations = new WorkOSOrganizations({ authority, userManagement: workos.userManagement, authorization: workos.authorization });
  const provider = new WorkOSAuthProvider({ authority, authkitIssuer: settings.authkitIssuer, mcpResourceUrl: config.mcpResourceUrl, keySet: authkitKeySet, grants: organizations });
  const session = new WorkOSBrowserSession({ workos, settings, authority });
  const server = new MCPServer({
    auth: { verifier: provider, accessResolver: provider, resourceMetadataUrl: config.resourceMetadataUrl, expectedResource: new URL(config.mcpResourceUrl), requiredPermission: PRODUCT_ACCESS },
    reportFailure: operatorFailureReporter(logger),
  });
  const mcp = new ProtectedResourceEndpoint({ server, mcpResourceUrl: config.mcpResourceUrl, resourceMetadataUrl: config.resourceMetadataUrl, authorizationServer: settings.authkitIssuer });
  const browserRoutes = new WorkOSSessionRoutes({ session, publicBaseUrl: config.publicBaseUrl, redirectUri: settings.redirectUri, reportFailure: accountFailureReporter(logger) });
  return { session, accessResolver: provider, organizations, mcp, browserRoutes };
}
