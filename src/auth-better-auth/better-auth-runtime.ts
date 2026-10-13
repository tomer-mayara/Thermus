import type { DatabaseSync } from 'node:sqlite';
import { mcp } from '@better-auth/mcp';
import { betterAuth } from 'better-auth';
import { admin } from 'better-auth/plugins/admin';
import { jwt } from 'better-auth/plugins/jwt';
import type { DeploymentConfig } from '../config/deployment-config.ts';
import { CLIENT_ADDRESS_HEADER } from '../http/server.ts';
import { lockDataDirectory, type DataDirectoryLock } from './data-directory-lock.ts';
import { openLocalInstallation, type LocalInstallation } from './local-installation.ts';

const PRIVATE_HTTP_PATHS = [
  '/admin/create-user',
  '/admin/list-users',
  '/admin/set-user-password',
  '/admin/ban-user',
  '/admin/revoke-user-sessions',
  '/oauth2/create-client',
  '/oauth2/get-client',
  '/oauth2/get-clients',
  '/oauth2/update-client',
  '/oauth2/client/rotate-secret',
  '/oauth2/delete-client',
  '/token',
];

export interface LocalProviderSettings {
  readonly publicBaseUrl: string;
  readonly mcpResourceUrl: string;
  readonly secret: string;
  readonly database: DatabaseSync;
  readonly installationId: string;
}

export function localProviderOptions(settings: LocalProviderSettings) {
  const authBase = new URL('api/auth', settings.publicBaseUrl);
  return {
    baseURL: authBase.origin,
    basePath: authBase.pathname,
    secret: settings.secret,
    database: settings.database,
    telemetry: { enabled: false },
    emailAndPassword: { enabled: true, disableSignUp: true },
    rateLimit: { enabled: true },
    advanced: { ipAddress: { ipAddressHeaders: [CLIENT_ADDRESS_HEADER] } },
    disabledPaths: PRIVATE_HTTP_PATHS,
    plugins: [
      admin(),
      jwt(),
      mcp({
        resource: settings.mcpResourceUrl,
        loginPage: new URL('sign-in', settings.publicBaseUrl).pathname,
        consentPage: new URL('consent', settings.publicBaseUrl).pathname,
        scopes: ['openid', 'profile', 'email'],
        grantTypes: ['authorization_code', 'client_credentials'],
        clientReference: () => settings.installationId,
      }),
    ],
  };
}

export type LocalAuth = ReturnType<typeof createLocalAuth>;

export type LocalAuthSettings = Pick<
  Extract<DeploymentConfig, { deployment: 'self-hosted' }>,
  'dataDirectory' | 'publicBaseUrl' | 'mcpResourceUrl'
>;

export interface LocalAuthResources {
  lockDataDirectory(directory: string): DataDirectoryLock;
  openInstallation(directory: string): LocalInstallation;
  startProvider(settings: LocalProviderSettings): Promise<LocalAuth>;
}

export interface BetterAuthRuntime {
  readonly installationId: string;
  readonly tenantId: string;
  readonly auth: LocalAuth;
  close(): Promise<void>;
}

const localAuthResources: LocalAuthResources = {
  lockDataDirectory,
  openInstallation: openLocalInstallation,
  startProvider: startLocalAuth,
};

export async function openBetterAuthRuntime(
  settings: LocalAuthSettings,
  resources: LocalAuthResources = localAuthResources,
): Promise<BetterAuthRuntime> {
  await using owned = new AsyncDisposableStack();
  owned.adopt(resources.lockDataDirectory(settings.dataDirectory), (lock) => lock.release());
  const installation = owned.adopt(resources.openInstallation(settings.dataDirectory), (opened) => opened.close());
  const auth = await resources.startProvider({
    publicBaseUrl: settings.publicBaseUrl,
    mcpResourceUrl: settings.mcpResourceUrl,
    secret: installation.secret,
    database: installation.database,
    installationId: installation.id,
  });
  return runtimeRecord(installation.id, auth, owned.move());
}

function runtimeRecord(installationId: string, auth: LocalAuth, owned: AsyncDisposableStack): BetterAuthRuntime {
  let closing: Promise<void> | undefined;
  return Object.freeze({
    installationId,
    tenantId: `local:${installationId}`,
    auth,
    close: () => closing ??= owned.disposeAsync(),
  });
}

function createLocalAuth(settings: LocalProviderSettings) {
  return betterAuth(localProviderOptions(settings));
}

// Waiting for the background schema check stops startup on a mismatch and leaves no database work running.
async function startLocalAuth(settings: LocalProviderSettings): Promise<LocalAuth> {
  const auth = createLocalAuth(settings);
  const context = await auth.$context;
  await context.checkSchema?.();
  return auth;
}
