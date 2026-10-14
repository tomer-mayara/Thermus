import { WorkOS } from '@workos-inc/node';

export interface HostedLiveSettings {
  readonly apiKey: string;
  readonly clientId: string;
  readonly authkitIssuer: string;
}

export const requestTimeout = 15_000;

export const localOrigin = 'https://localhost:46443';
export const browserRedirectUri = `${localOrigin}/callback`;
export const mcpResource = `${localOrigin}/mcp`;
export const signOutUri = `${localOrigin}/`;
export const initiateLoginUri = `${localOrigin}/login`;
export const connectRedirectUri = 'http://127.0.0.1:46480/callback';
export const connectScope = 'openid profile email offline_access';

export const hostedRolePermissions: Readonly<Record<string, readonly string[]>> = {
  user: ['product:access'],
  admin: ['user-grants:manage'],
  'super-admin': ['admin-grants:manage', 'billing:manage'],
  member: [],
};
export const applicationPermissions: readonly string[] = Object.values(hostedRolePermissions).flat();

export function workosClient({ apiKey, clientId }: HostedLiveSettings): WorkOS {
  // No retry and a short timeout: a live failure shows at once, in the proof that caused it.
  return new WorkOS({ apiKey, clientId, maxRetries: 0, timeout: requestTimeout });
}

export function browserIssuer({ clientId }: HostedLiveSettings): string {
  return `https://api.workos.com/user_management/${clientId}`;
}

export function authkitKeySetUrl(issuer: string): string {
  return `${issuer}/oauth2/jwks`;
}

export function applicationPermissionsOf(permissions: readonly string[]): string[] {
  return permissions.filter((permission) => applicationPermissions.includes(permission)).toSorted();
}
