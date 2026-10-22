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

export function workosClient({ apiKey, clientId }: HostedLiveSettings): WorkOS {
  // No retry and a short timeout: a live failure shows at once, in the proof that caused it.
  return new WorkOS({ apiKey, clientId, maxRetries: 0, timeout: requestTimeout });
}
