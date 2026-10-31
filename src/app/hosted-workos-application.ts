import type { SystemLog } from '../logs/system/system-logger.ts';
import { AuditLog } from '../logs/audit/audit-log.ts';
import { AuditSnapshots, type AuditSnapshotsOptions, type RevisionBoundAuditSink } from '../logs/audit/audit-snapshots.ts';
import type { ToolOperations } from './fetch-tool.ts';
import type { HostedLoggingStorage } from './logging-storage.ts';
import type { TenantProvisioningSettings } from '../runtime/config/mcp-tenants-config.ts';
import type { GatewayParts } from './mcp-gateway-composition.ts';
import type { WorkOS } from '@workos-inc/node';
import type { JWTVerifyGetKey } from 'jose';
import {
  accessDeniedDescription,
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
import type { SignupTenants } from '../interfaces/web/auth/workos/workos-signup-tenants.ts';
import { portalAccessOperation, PRODUCT_ACCESS, type PortalReads } from '../interfaces/web/account/portal-access.ts';
import { MCPServer, type RequestServerBuilder } from '../interfaces/mcp/mcp-server.ts';

type Environment = Readonly<Record<string, string | undefined>>;

export interface WorkOSConnection {
  readonly settings: WorkOSSettings;
  readonly workos: WorkOS;
  readonly authkitKeySet: JWTVerifyGetKey;
}

export interface WorkOSApplicationParts {
  readonly logger: SystemLog;
  readonly loggingStorage?: HostedLoggingStorage;
  readonly audit?: AuditLog;
  readonly toolOperations?: ToolOperations;
  readonly auditSink?: RevisionBoundAuditSink;
  readonly snapshotOptions?: AuditSnapshotsOptions;
  readonly buildServer?: RequestServerBuilder;
  readonly onboarding?: GoogleOnboardingSettings;
  readonly signup?: { readonly enabled: boolean; readonly documents?: SignupDocuments };
  readonly billing?: Billing;
  // With MCP_TENANTS_ENABLED on: MCPServer forwards each admitted request to the tenant of the organization, and
  // /internal/audit takes the audit relays of the tenants. Without it, the control plane serves the tools as today.
  readonly gateway?: GatewayParts;
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
  const gateway = (await import('./mcp-gateway-composition.ts')).gatewayStartOf(environment);
  const provisioningSettings = await tenantProvisioningSettingsOf(environment);
  gateway.requireSigningKeyIn(provisioningSettings?.gatewayPublicKey);
  if (new URL(config.publicBaseUrl).pathname !== '/') throw new Error('The hosted portal requires PUBLIC_BASE_URL with the base path /.');
  const { assertHostedRenderer } = await import('./hosted-renderer-startup.ts');
  await assertHostedRenderer(environment.LIGHTPANDA_BIN);
  const { HostedPortal } = await import('./hosted-portal.ts');
  const portal = await HostedPortal.load(['https://api.workos.com', connection.settings.authkitIssuer]);
  const { openLoggingStorage } = await import('./logging-storage.ts');
  await using resources = new AsyncDisposableStack();
  const opened = await openLoggingStorage(environment, logger, gateway.freeTenantLimit);
  const loggingStorage = provisioningSettings === undefined ? opened : (await import('./tenant-provisioning.ts')).withTenantProvisioning(opened, {
    settings: provisioningSettings, publicBaseUrl: config.publicBaseUrl, authkitIssuer: connection.settings.authkitIssuer, logger, workos: connection.workos,
  });
  if (loggingStorage !== undefined) resources.defer(() => loggingStorage.close());
  const application = await composeWorkOSApplication(config, connection, { logger, toolOperations: operations, signup, loggingStorage, gateway: gateway.partsOn(loggingStorage) });
  resources.move();
  return portal.withApplication(application);
}

async function tenantProvisioningSettingsOf(environment: Environment): Promise<TenantProvisioningSettings | undefined> {
  const { loadMcpTenantsEnabled, loadTenantProvisioningSettings } = await import('../runtime/config/mcp-tenants-config.ts');
  return loadMcpTenantsEnabled(environment) ? loadTenantProvisioningSettings(environment) : undefined;
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
  const { audit, storage } = auditParts(parts, owned);
  const buildServer = await buildServerOf(parts, audit);
  const billing = await billingOf(parts);
  // Signup and the portal follow the tenant of each organization through the registry rules of the gateway (SO-07).
  const { workspacePartsOf } = await import('./workspace-composition.ts');
  const workspaces = workspacePartsOf({ gateway: parts.gateway, storage: parts.loggingStorage, logger: parts.logger });
  const providerParts = await workosProviderParts(config, connection, { ...parts, buildServer, billing, audit, signupTenants: workspaces.signup });
  const application = composeHostedApplication(config, providerParts, {
    reportFailure: accountFailureReporter(parts.logger),
    changeRecords: accountChangeRecorder(parts.logger),
    audit,
    billing,
    operation: portalAccessOperation(config.publicBaseUrl, config.mcpResourceUrl, portalReads(providerParts.organizations, billing)),
    signupUrl: new URL('signup', config.publicBaseUrl).href,
    storage,
    workspaces: workspaces.statuses,
  });
  owned.move();
  return application;
}

function auditParts(parts: WorkOSApplicationParts, owned: DisposableStack): { readonly audit: AuditLog; readonly storage?: HostedLoggingStorage } {
  const storage = parts.loggingStorage;
  if (parts.audit !== undefined || storage === undefined) return { audit: parts.audit ?? discardAuditLog(), storage };
  const snapshots = owned.adopt(new AuditSnapshots(storage.store, parts.auditSink ?? storage.dispatch ?? { admit: () => false }, parts.snapshotOptions), (capture) => capture.close());
  return { audit: new AuditLog(snapshots), storage: { ...storage, close: () => { snapshots.close(); return storage.close(); } } };
}

async function buildServerOf(parts: WorkOSApplicationParts, audit: AuditLog): Promise<RequestServerBuilder | undefined> {
  if (parts.buildServer !== undefined || parts.toolOperations === undefined) return parts.buildServer;
  const { fetchToolServers } = await import('./fetch-tool.ts');
  return fetchToolServers(parts.toolOperations, parts.logger, audit);
}

function portalReads(organizations: WorkOSOrganizations, billing: Billing): PortalReads {
  return {
    organizationNameOf: (user, organizationId) => organizations.activeOrganizationName(user, organizationId),
    billingOf: (organizationId) => billing.stateOf(organizationId),
  };
}

async function billingOf(parts: WorkOSApplicationParts): Promise<Billing> {
  if (parts.billing !== undefined) return parts.billing;
  const { BillingFree } = await import('../accounts/billing/billing-free.ts');
  return new BillingFree();
}

async function workosProviderParts(config: RouteConfig, connection: WorkOSConnection, parts: WorkOSApplicationParts & { readonly billing: Billing; readonly audit: AuditLog; readonly signupTenants?: SignupTenants }): Promise<HostedProviderParts & { readonly organizations: WorkOSOrganizations }> {
  const { WorkOSOrganizations } = await import('../accounts/providers/workos/workos-organizations.ts');
  const { workosMembershipReads } = await import('../accounts/providers/workos/workos-membership-reads.ts');
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
  const organizations = new WorkOSOrganizations({ authority, memberships: workosMembershipReads(workos), userManagement: workos.userManagement, authorization: workos.authorization });
  const provider = new WorkOSAuthProvider({ authority, authkitIssuer: settings.authkitIssuer, mcpResourceUrl: config.mcpResourceUrl, keySet: authkitKeySet, grants: organizations, userManagement: workos.userManagement });
  const { WorkOSGoogleOnboarding } = await import('../accounts/providers/workos/workos-google-onboarding.ts');
  const onboarding = parts.onboarding === undefined ? undefined : new WorkOSGoogleOnboarding({
    ...parts.onboarding, authority, workos, settings, records: accountChangeRecorder(logger), billing: parts.billing, directory: organizations,
  });
  const session = new WorkOSBrowserSession({ workos, settings, authority, ...(onboarding === undefined ? {} : { onboarding }) });
  const gateway = parts.gateway === undefined ? undefined : (await import('./mcp-gateway-composition.ts')).gatewayRoutesOf(parts.gateway, { authority, audit: parts.audit, logger });
  const server = new MCPServer({
    auth: {
      verifier: provider,
      accessResolver: provider,
      resourceMetadataUrl: config.resourceMetadataUrl,
      expectedResource: new URL(config.mcpResourceUrl),
      requiredPermission: PRODUCT_ACCESS,
      accessDeniedDescription: accessDeniedDescription(config.publicBaseUrl),
    },
    buildServer,
    forward: gateway?.forward,
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
    ...(parts.signupTenants === undefined ? {} : { tenants: parts.signupTenants }),
  });
  const browserRoutes = {
    handles: (path: string) => signupRoutes.handles(path) || sessionRoutes.handles(path),
    handle: (request: Request) => signupRoutes.handles(new URL(request.url).pathname) ? signupRoutes.handle(request) : sessionRoutes.handle(request),
  };
  return { session, accessResolver: provider, organizations, mcp, browserRoutes, internalRoutes: gateway?.internalRoutes };
}
