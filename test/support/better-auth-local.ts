import { DatabaseSync } from 'node:sqlite';
import { mcp } from '@better-auth/mcp';
import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { admin } from 'better-auth/plugins/admin';
import { jwt } from 'better-auth/plugins/jwt';

export const publicBaseUrl = 'http://localhost:8080';
export const authIssuer = `${publicBaseUrl}/api/auth`;
export const mcpResourceUrl = `${publicBaseUrl}/mcp`;
export const clientAddressHeader = 'x-magumagu-client-address';

const privateHttpPaths = [
  '/admin/create-user',
  '/admin/list-users',
  '/admin/set-user-password',
  '/admin/ban-user',
  '/admin/revoke-user-sessions',
  '/oauth2/create-client',
  '/oauth2/update-client',
  '/oauth2/delete-client',
  '/oauth2/get-clients',
  '/token',
];

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
      mcp({ resource: mcpResourceUrl, loginPage: '/sign-in', consentPage: '/consent' }),
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
