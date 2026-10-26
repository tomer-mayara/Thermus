import type { SystemLog } from '../logs/system/system-logger.ts';
import { AuditLog } from '../logs/audit/audit-log.ts';
import { AuditSnapshots, type AuditSnapshotsOptions, type RevisionBoundAuditSink } from '../logs/audit/audit-snapshots.ts';
import type { ToolOperations } from './fetch-tool.ts';
import type { HostedLoggingStorage } from './logging-storage.ts';
import type { WorkOS } from '@workos-inc/node';
import type { JWTVerifyGetKey } from 'jose';
import {
  accountChangeRecorder,
  accountFailureReporter,
  composeHostedApplication,
  discardAuditLog,
  operatorFailureReporter,
  type Application,
  type HostedProviderParts,
  type RouteConfig,
} from './application.ts';
import type { Billing } from '../accounts/billing/billing.ts';
import type { GoogleOnboardingSettings } from '../accounts/providers/workos/workos-google-onboarding.ts';
import type { WorkOSSettings } from '../accounts/providers/workos/workos-settings.ts';
import type { WorkOSOrganizations } from '../accounts/providers/workos/workos-organizations.ts';
import type { SignupDocuments } from '../accounts/organizations/signup-activation.ts';
import { portalAccessOperation, PRODUCT_ACCESS } from '../interfaces/web/account/portal-access.ts';
import { MCPServer, type RequestServerBuilder } from '../interfaces/mcp/mcp-server.ts';

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
  readonly logger: SystemLog;
  readonly loggingStorage?: HostedLoggingStorage;
  // Explicit audit and tool-server overrides take precedence in development compositions.
  readonly audit?: AuditLog;
  readonly toolOperations?: ToolOperations;
  // Explicit development composition can replace the customer dispatch sink.
  readonly auditSink?: RevisionBoundAuditSink;
  readonly snapshotOptions?: AuditSnapshotsOptions;
  readonly buildServer?: RequestServerBuilder;
  // Omitted by production. A slice must select its enrollment organization explicitly.
  readonly onboarding?: GoogleOnboardingSettings;
  // Explicit composition supplies its own documents. Production selects the approved organization removal bundle at startup.
  readonly signup?: { readonly enabled: boolean; readonly documents?: SignupDocuments };
}

// No retry and a short timeout: each WorkOS call runs during a browser or MCP request.
const WORKOS_REQUEST_TIMEOUT_MS = 5_000;

export async function openWorkOSApplication(config: RouteConfig, logger: SystemLog, environment: Environment): Promise<Application> {
  const { loadSelfServeSignupEnabled } = await import('../accounts/providers/workos/workos-signup-settings.ts');
  const { organizationRemovalDocuments } = await import('../accounts/providers/workos/workos-organization-removal-documents.ts');
  const signup = { enabled: loadSelfServeSignupEnabled(environment), documents: organizationRemovalDocuments };
  const connection = await openWorkOSConnection(config, logger, environment);
  const { createHostedToolOperations } = await import('./fetch-tool.ts');
  const operations = createHostedToolOperations(environment, logger);
  if (new URL(config.publicBaseUrl).pathname !== '/') throw new Error('The hosted portal requires PUBLIC_BASE_URL with the base path /.');
  const { assertHostedRenderer } = await import('./hosted-renderer-startup.ts');
  await assertHostedRenderer(environment.LIGHTPANDA_BIN);
  const { HostedPortal } = await import('./hosted-portal.ts');
  const portal = await HostedPortal.load(['https://api.workos.com', connection.settings.authkitIssuer]);
  const { openLoggingStorage } = await import('./logging-storage.ts');
  await using resources = new AsyncDisposableStack();
  const loggingStorage = await openLoggingStorage(environment, logger);
  if (loggingStorage !== undefined) resources.defer(() => loggingStorage.close());
  const application = await composeWorkOSApplication(config, connection, { logger, toolOperations: operations, signup, loggingStorage });
  resources.move();
  return portal.withApplication(application);
}

// Invalid or missing WorkOS settings stop the start before the server listens. There is no fallback to local or
// anonymous access. The connection makes no WorkOS call: the key set loads at the first check of a Connect token.
export async function openWorkOSConnection(config: RouteConfig, logger: SystemLog, environment: Environment): Promise<WorkOSConnection> {
  const { browserSessionIssuer, loadWorkOSSettings } = await import('../accounts/providers/workos/workos-settings.ts');
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
  using owned = new DisposableStack();
  const snapshots = parts.audit === undefined && parts.loggingStorage !== undefined
    ? owned.adopt(new AuditSnapshots(parts.loggingStorage.store, parts.auditSink ?? parts.loggingStorage.dispatch ?? { admit: () => false }, parts.snapshotOptions), (capture) => capture.close())
    : undefined;
  const audit = parts.audit ?? (snapshots === undefined ? discardAuditLog() : new AuditLog(snapshots));
  let buildServer = parts.buildServer;
  if (buildServer === undefined && parts.toolOperations !== undefined) {
    const { fetchToolServers } = await import('./fetch-tool.ts');
    buildServer = fetchToolServers(parts.toolOperations, parts.logger, audit);
  }
  let loggingStorage = parts.loggingStorage;
  if (loggingStorage !== undefined && snapshots !== undefined) {
    const storage = loggingStorage;
    loggingStorage = { ...storage, close: () => { snapshots.close(); return storage.close(); } };
  }
  const { BillingFree } = await import('../accounts/billing/billing-free.ts');
  const billing = new BillingFree();
  const providerParts = await workosProviderParts(config, connection, { ...parts, buildServer, billing });
  const application = composeHostedApplication(config, providerParts, {
    reportFailure: accountFailureReporter(parts.logger),
    changeRecords: accountChangeRecorder(parts.logger),
    audit,
    billing,
    operation: portalAccessOperation(config.publicBaseUrl, config.mcpResourceUrl, (user, organizationId) => providerParts.organizations.activeOrganizationName(user, organizationId)),
    signupUrl: new URL('signup', config.publicBaseUrl).href,
  }, loggingStorage);
  owned.move();
  return application;
}

async function workosProviderParts(config: RouteConfig, connection: WorkOSConnection, parts: WorkOSApplicationParts & { readonly billing: Billing }): Promise<HostedProviderParts & { readonly organizations: WorkOSOrganizations }> {
  const { WorkOSOrganizations, workosMembershipReads } = await import('../accounts/providers/workos/workos-organizations.ts');
  const { WorkOSAuthProvider } = await import('../accounts/providers/workos/workos-auth-provider.ts');
  const { WorkOSBrowserSession } = await import('../accounts/providers/workos/workos-browser-session.ts');
  const { WorkOSSessionRoutes } = await import('../interfaces/web/auth/workos/workos-session-routes.ts');
  const { WorkOSSignup } = await import('../accounts/providers/workos/workos-signup.ts');
  const { WorkOSSignupRoutes } = await import('../interfaces/web/auth/workos/workos-signup-routes.ts');
  const { workosAuthority } = await import('../accounts/providers/workos/workos-settings.ts');
  const { ProtectedResourceEndpoint } = await import('../interfaces/mcp/protected-resource-endpoint.ts');
  const { settings, workos, authkitKeySet } = connection;
  const { logger, buildServer } = parts;
  const authority = workosAuthority(settings.clientId);
  // One directory gives the current grants to access resolution, and the organizations, members, and invitations and
  // their changes to the account routes.
  const organizations = new WorkOSOrganizations({ authority, memberships: workosMembershipReads(workos), userManagement: workos.userManagement, authorization: workos.authorization });
  const provider = new WorkOSAuthProvider({ authority, authkitIssuer: settings.authkitIssuer, mcpResourceUrl: config.mcpResourceUrl, keySet: authkitKeySet, grants: organizations, userManagement: workos.userManagement });
  const { WorkOSGoogleOnboarding } = await import('../accounts/providers/workos/workos-google-onboarding.ts');
  const onboarding = parts.onboarding === undefined ? undefined : new WorkOSGoogleOnboarding({
    ...parts.onboarding, authority, workos, settings, records: accountChangeRecorder(logger), billing: parts.billing, directory: organizations,
  });
  const session = new WorkOSBrowserSession({ workos, settings, authority, ...(onboarding === undefined ? {} : { onboarding }) });
  const server = new MCPServer({
    auth: {
      verifier: provider,
      accessResolver: provider,
      resourceMetadataUrl: config.resourceMetadataUrl,
      expectedResource: new URL(config.mcpResourceUrl),
      requiredPermission: PRODUCT_ACCESS,
      accessDeniedDescription: `Access denied. Open ${new URL('signup', config.publicBaseUrl).href} to check free signup availability. If you already have access, reauthorize this MCP client and choose the intended workspace.`,
    },
    buildServer,
    reportFailure: operatorFailureReporter(logger),
  });
  const mcp = new ProtectedResourceEndpoint({ server, mcpResourceUrl: config.mcpResourceUrl, resourceMetadataUrl: config.resourceMetadataUrl, authorizationServer: settings.authkitIssuer });
  const sessionRoutes = new WorkOSSessionRoutes({ session, accessResolver: provider, publicBaseUrl: config.publicBaseUrl, redirectUri: settings.redirectUri, reportFailure: accountFailureReporter(logger) });
  const signupRoutes = new WorkOSSignupRoutes({
    publicBaseUrl: config.publicBaseUrl,
    enabled: parts.signup?.enabled ?? false,
    documents: parts.signup?.documents,
    session,
    activation: new WorkOSSignup({ authority, workos, directory: organizations }),
    reportFailure: (message) => logger.error(message),
  });
  const browserRoutes = {
    handles: (path: string) => signupRoutes.handles(path) || sessionRoutes.handles(path),
    handle: (request: Request) => signupRoutes.handles(new URL(request.url).pathname) ? signupRoutes.handle(request) : sessionRoutes.handle(request),
  };
  return { session, accessResolver: provider, organizations, mcp, browserRoutes };
}
