import { DatabaseSync } from 'node:sqlite';
import { mcp, type McpOptions } from '@better-auth/mcp';
import { betterAuth } from 'better-auth';
import { applySetCookies } from 'better-auth/cookies';
import { getMigrations } from 'better-auth/db/migration';
import { admin } from 'better-auth/plugins/admin';
import { jwt } from 'better-auth/plugins/jwt';

export const publicBaseUrl = 'http://localhost:8080';
export const authIssuer = `${publicBaseUrl}/api/auth`;
export const mcpResourceUrl = `${publicBaseUrl}/mcp`;
export const clientAddressHeader = 'x-magumagu-client-address';
export const localInstallationId = '0f6c1e9a-4b7d-4e2a-9c35-8d1f2a6b7e40';

export interface AccountCredentials {
  readonly email: string;
  readonly password: string;
}

const privateHttpPaths = [
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

const withoutOfflineGrants = {
  scopes: ['openid', 'profile', 'email'],
  grantTypes: ['authorization_code', 'client_credentials'],
} satisfies Pick<McpOptions, 'scopes' | 'grantTypes'>;

function localProviderOptions(database: DatabaseSync) {
  return {
    baseURL: publicBaseUrl,
    secret: 'interface-test-secret-0123456789abcdef0123456789',
    database,
    telemetry: { enabled: false },
    emailAndPassword: { enabled: true, disableSignUp: true },
    rateLimit: { enabled: true },
    advanced: { ipAddress: { ipAddressHeaders: [clientAddressHeader] } },
    disabledPaths: privateHttpPaths,
    plugins: [
      admin(),
      jwt(),
      mcp({
        resource: mcpResourceUrl,
        loginPage: '/sign-in',
        consentPage: '/consent',
        ...withoutOfflineGrants,
        clientReference: () => localInstallationId,
      }),
    ],
  };
}

export async function startLocalProvider() {
  const database = new DatabaseSync(':memory:');
  const options = localProviderOptions(database);
  await (await getMigrations(options)).runMigrations();
  return { auth: betterAuth(options), database };
}

export type LocalAuth = Awaited<ReturnType<typeof startLocalProvider>>['auth'];

export async function withRegistrationSession<T>(
  auth: LocalAuth,
  account: AccountCredentials,
  register: (sessionHeaders: Headers) => Promise<T>,
): Promise<T> {
  const { headers, response } = await auth.api.signInEmail({
    body: { email: account.email, password: account.password },
    returnHeaders: true,
  });
  const sessionHeaders = new Headers();
  applySetCookies(sessionHeaders, headers.getSetCookie());
  try {
    return await register(sessionHeaders);
  } finally {
    await (await auth.$context).internalAdapter.deleteSession(response.token);
  }
}
