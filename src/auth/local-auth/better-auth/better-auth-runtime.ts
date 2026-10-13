import type { DatabaseSync } from 'node:sqlite';
import { mcp } from '@better-auth/mcp';
import { betterAuth } from 'better-auth';
import { admin } from 'better-auth/plugins/admin';
import { jwt } from 'better-auth/plugins/jwt';
import type { LocalAuthSettings } from '../local-user-administration.ts';
import { CLIENT_ADDRESS_HEADER } from '../../../http/client-address.ts';
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

// The pinned Better Auth reads these variables also when an option sets the related value. No option stops that,
// except `secrets` for BETTER_AUTH_SECRETS, and `secrets` changes the encryption format of the keys in auth.sqlite.
const REFUSED_PROVIDER_VARIABLES: Readonly<Record<string, string>> = {
  BETTER_AUTH_SECRETS: 'replace the secret in DATA_DIR/auth.secret',
  BETTER_AUTH_TRUSTED_ORIGINS: 'add trusted origins to the origin, CSRF, and callback URL checks',
  BETTER_AUTH_TELEMETRY: 'turn on telemetry',
};

export interface ResourceServerClient {
  readonly clientId: string;
  readonly clientSecret: string;
}

// The resource-server client of the MCP resource of this runtime, which is the MCP resource of PUBLIC_BASE_URL.
export interface ResourceServerClientRecord {
  // Gives undefined when no client is stored, or when the stored client is for another MCP resource.
  current(): ResourceServerClient | undefined;
  // Replaces a stored client. The client is durable when this returns.
  record(client: ResourceServerClient): void;
}

export interface LocalProviderSettings {
  readonly publicBaseUrl: string;
  readonly mcpResourceUrl: string;
  readonly secret: string;
  readonly database: DatabaseSync;
  readonly installationId: string;
}

export class ProviderEnvironmentError extends Error {
  constructor(variable: string, effect: string) {
    super(`${variable} must be empty or not set. Better Auth can use it to ${effect}. Remove it from the environment of the Thermus process.`);
    this.name = 'ProviderEnvironmentError';
  }
}

export function localProviderOptions(settings: LocalProviderSettings) {
  refuseProviderVariables();
  const authBase = new URL('api/auth', settings.publicBaseUrl);
  return {
    baseURL: authBase.origin,
    basePath: authBase.pathname,
    secret: settings.secret,
    database: settings.database,
    telemetry: { enabled: false },
    emailAndPassword: { enabled: true, disableSignUp: true },
    // Introspection is private and runs for every MCP request. A shared quota would deny valid users.
    rateLimit: { enabled: true, customRules: { '/oauth2/introspect': false as const } },
    onAPIError: { errorURL: new URL('authorization-error', settings.publicBaseUrl).href },
    advanced: {
      ipAddress: { ipAddressHeaders: [CLIENT_ADDRESS_HEADER] },
      // Without this setting, NODE_ENV=test, or TEST with a value other than false, turns off the origin and CSRF checks.
      disableOriginCheck: false,
    },
    disabledPaths: PRIVATE_HTTP_PATHS,
    plugins: [
      admin(),
      jwt(),
      mcp({
        resource: settings.mcpResourceUrl,
        loginPage: new URL('sign-in', settings.publicBaseUrl).pathname,
        consentPage: new URL('consent', settings.publicBaseUrl).pathname,
        allowPublicClientPrelogin: true,
        scopes: ['openid', 'profile', 'email'],
        grantTypes: ['authorization_code', 'client_credentials'],
        clientReference: () => settings.installationId,
      }),
    ],
  };
}

function refuseProviderVariables(): void {
  for (const [variable, effect] of Object.entries(REFUSED_PROVIDER_VARIABLES)) {
    if (process.env[variable]) throw new ProviderEnvironmentError(variable, effect);
  }
}

export type LocalAuth = ReturnType<typeof createLocalAuth>;

export interface LocalAuthResources {
  lockDataDirectory(directory: string): DataDirectoryLock;
  openInstallation(directory: string): LocalInstallation;
  startProvider(settings: LocalProviderSettings): Promise<LocalAuth>;
}

export interface BetterAuthRuntime {
  readonly installationId: string;
  readonly tenantId: string;
  readonly auth: LocalAuth;
  readonly resourceServerClient: ResourceServerClientRecord;
  close(): Promise<void>;
}

type OpenedRuntime = Pick<BetterAuthRuntime, 'installationId' | 'auth' | 'resourceServerClient'>;

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
  const resourceServerClient = resourceServerClientRecord(installation, settings.mcpResourceUrl);
  return runtimeRecord({ installationId: installation.id, auth, resourceServerClient }, owned.move());
}

function runtimeRecord(opened: OpenedRuntime, owned: AsyncDisposableStack): BetterAuthRuntime {
  let closing: Promise<void> | undefined;
  return Object.freeze({
    ...opened,
    tenantId: `local:${opened.installationId}`,
    close: () => closing ??= owned.disposeAsync(),
  });
}

function resourceServerClientRecord(installation: LocalInstallation, resource: string): ResourceServerClientRecord {
  return Object.freeze({
    current: () => {
      const stored = installation.readResourceServerClient();
      return stored?.resource === resource ? { clientId: stored.clientId, clientSecret: stored.clientSecret } : undefined;
    },
    record: ({ clientId, clientSecret }: ResourceServerClient) => installation.writeResourceServerClient({ clientId, clientSecret, resource }),
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
