import { WorkOS } from '@workos-inc/node';

export interface HostedLiveSettings {
  readonly apiKey: string;
  readonly clientId: string;
  readonly authkitIssuer: string;
}

export const requestTimeout = 15_000;

// WorkOS Staging registers the URIs of these two fixed ports, so a run that uses them cannot use port 0. Both ports are
// below the ephemeral port ranges of Linux (32768 to 60999) and macOS (49152 to 65535): an outgoing socket of another
// program cannot take them. Nothing listens on the Connect callback port; the browser of the proofs catches it.
export const localSitePort = 24443;
const connectCallbackPort = 24480;

export const localOrigin = `https://localhost:${localSitePort}`;
export const browserRedirectUri = `${localOrigin}/callback`;
export const mcpResource = `${localOrigin}/mcp`;
export const signOutUri = `${localOrigin}/`;
export const initiateLoginUri = `${localOrigin}/login`;
export const connectRedirectUri = `http://127.0.0.1:${connectCallbackPort}/callback`;
export const connectScope = 'openid profile email offline_access';

export function workosClient({ apiKey, clientId }: HostedLiveSettings): WorkOS {
  // No retry and a short timeout: a live failure shows at once, in the proof that caused it.
  return new WorkOS({ apiKey, clientId, maxRetries: 0, timeout: requestTimeout });
}
