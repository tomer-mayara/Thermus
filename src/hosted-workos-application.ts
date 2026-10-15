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
import type { Billing } from './billing/billing.ts';
import type { GoogleOnboardingSettings } from './auth/hosted-auth/workos/workos-google-onboarding.ts';
import type { WorkOSSettings } from './auth/hosted-auth/workos/workos-settings.ts';
import { portalAccessOperation, PRODUCT_ACCESS } from './hosted-admin/portal-access.ts';
import { MCPServer, type RequestServerBuilder } from './mcp/mcp-server.ts';

type Environment = Readonly<Record<string, string | undefined>>;

// The connection to one WorkOS environment: its settings, an SDK client, and the AuthKit key set of the Connect
// tokens. The production connection reaches WorkOS; a test can point the client and the key set at a local fake.
export interface WorkOSConnection {
  readonly settings: WorkOSSettings;
  readonly workos: WorkOS;
  readonly authkitKeySet: JWTVerifyGetKey;
}

// The parts of the hosted application that a composition root chooses. Production supplies the shared fetch
// operation; a development composition can supply another request-scoped tool server.
export interface WorkOSApplicationParts {
  readonly logger: ApplicationLogger;
  readonly buildServer?: RequestServerBuilder;
  // Omitted by production. A slice must select its enrollment organization explicitly.
  readonly onboarding?: GoogleOnboardingSettings;
  // A composition can discard MFA evidence, but only the configured Required policy can supply it.
  readonly mfaEvidence?: 'unproven';
}

// No retry and a short timeout: each WorkOS call runs during a browser or MCP request.
const WORKOS_REQUEST_TIMEOUT_MS = 5_000;

export async function openWorkOSApplication(config: RouteConfig, logger: ApplicationLogger, environment: Environment): Promise<Application> {
  const connection = await openWorkOSConnection(config, logger, environment);
  const { createFetchOperation, fetchToolServers } = await import('./fetch-tool.ts');
  const { singleFetchOperation } = await import('./mcp/single-fetch-operation.ts');
  const operation = singleFetchOperation(createFetchOperation(environment, logger));
  return composeWorkOSApplication(config, connection, { logger, buildServer: fetchToolServers(operation, logger) });
}

// Invalid or missing WorkOS settings stop the start before the server listens. There is no fallback to local or
// anonymous access. The connection makes no WorkOS call: the key set loads at the first check of a Connect token.
export async function openWorkOSConnection(config: RouteConfig, logger: ApplicationLogger, environment: Environment): Promise<WorkOSConnection> {
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
  return { settings, workos, authkitKeySet };
}

export async function composeWorkOSApplication(config: RouteConfig, connection: WorkOSConnection, parts: WorkOSApplicationParts): Promise<Application> {
  const { BillingFree } = await import('./billing/billing-free.ts');
  const billing = new BillingFree();
  const providerParts = await workosProviderParts(config, connection, { ...parts, billing });
  return composeHostedApplication(config, providerParts, {
    reportFailure: accountFailureReporter(parts.logger),
    changeRecords: accountChangeRecorder(parts.logger),
    billing,
    operation: portalAccessOperation(config.publicBaseUrl),
  });
}

async function workosProviderParts(config: RouteConfig, connection: WorkOSConnection, parts: WorkOSApplicationParts & { readonly billing: Billing }): Promise<HostedProviderParts> {
  const { WorkOSOrganizations } = await import('./auth/hosted-auth/workos/workos-organizations.ts');
  const { WorkOSAuthProvider } = await import('./auth/hosted-auth/workos/workos-auth-provider.ts');
  const { WorkOSBrowserSession } = await import('./auth/hosted-auth/workos/workos-browser-session.ts');
  const { WorkOSSessionRoutes } = await import('./auth/hosted-auth/workos/workos-session-routes.ts');
  const { workosAuthority } = await import('./auth/hosted-auth/workos/workos-settings.ts');
  const { ProtectedResourceEndpoint } = await import('./mcp/protected-resource-endpoint.ts');
  const { settings, workos, authkitKeySet } = connection;
  const { logger, buildServer } = parts;
  const authority = workosAuthority(settings.clientId);
  // One directory gives the current grants to access resolution, and the organizations, members, and invitations and
  // their changes to the account routes.
  const organizations = new WorkOSOrganizations({ authority, userManagement: workos.userManagement, authorization: workos.authorization, organizations: workos.organizations });
  const provider = new WorkOSAuthProvider({ authority, authkitIssuer: settings.authkitIssuer, mcpResourceUrl: config.mcpResourceUrl, keySet: authkitKeySet, grants: organizations });
  const { WorkOSGoogleOnboarding } = await import('./auth/hosted-auth/workos/workos-google-onboarding.ts');
  const onboarding = parts.onboarding === undefined ? undefined : new WorkOSGoogleOnboarding({
    ...parts.onboarding, authority, workos, settings, records: accountChangeRecorder(logger), billing: parts.billing, directory: organizations,
  });
  const session = new WorkOSBrowserSession({ workos, settings, authority, mfaEvidence: parts.mfaEvidence ?? (settings.mfaPolicy === 'required' ? 'password-mfa-required' : 'unproven'), ...(onboarding === undefined ? {} : { onboarding }) });
  const server = new MCPServer({
    auth: { verifier: provider, accessResolver: provider, resourceMetadataUrl: config.resourceMetadataUrl, expectedResource: new URL(config.mcpResourceUrl), requiredPermission: PRODUCT_ACCESS },
    buildServer,
    reportFailure: operatorFailureReporter(logger),
  });
  const mcp = new ProtectedResourceEndpoint({ server, mcpResourceUrl: config.mcpResourceUrl, resourceMetadataUrl: config.resourceMetadataUrl, authorizationServer: settings.authkitIssuer });
  const browserRoutes = new WorkOSSessionRoutes({ session, publicBaseUrl: config.publicBaseUrl, redirectUri: settings.redirectUri, reportFailure: accountFailureReporter(logger) });
  return { session, accessResolver: provider, organizations, mcp, browserRoutes };
}
