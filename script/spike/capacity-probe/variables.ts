import { randomBytes } from 'node:crypto';
import type { Variables } from '../render-tenant-lifecycle/calls.ts';
import type { HostedLiveSettings } from '../../../test/support/hosted-live/settings.ts';

// The setting of D-15: 10 fetch or search calls at the same time in one process.
export const OPERATION_CAPACITY = '10';
export const SECRET_SHOWN = '<set>';
const SECRET_KEYS: ReadonlySet<string> = new Set(['WORKOS_API_KEY', 'WORKOS_COOKIE_PASSWORD']);

// Render gives a web service the host <name>.onrender.com when the name is free; the setup checks the answer.
export function predictedOrigin(name: string): string {
  return `https://${name}.onrender.com`;
}

// The hosted server takes its MCP resource from PUBLIC_BASE_URL: new URL('mcp', base) (deployment-config.ts).
export function baseUrlOf(origin: string): string {
  return `${origin}/`;
}

export function resourceOf(origin: string): string {
  return new URL('mcp', baseUrlOf(origin)).href;
}

// The variables that the hosted image does not set itself. Dockerfile.hosted sets DEPLOYMENT, the renderer, and the
// listen address; without DATABASE_URL, logging storage stays off and MCP stays available.
export function tenantVariables(origin: string, workos: HostedLiveSettings, cookiePassword: string): Variables {
  const base = baseUrlOf(origin);
  return [
    ['PUBLIC_BASE_URL', base],
    ['WORKOS_API_KEY', workos.apiKey],
    ['WORKOS_CLIENT_ID', workos.clientId],
    ['WORKOS_AUTHKIT_ISSUER', workos.authkitIssuer],
    ['WORKOS_REDIRECT_URI', new URL('callback', base).href],
    ['WORKOS_COOKIE_PASSWORD', cookiePassword],
    ['OPERATION_CAPACITY', OPERATION_CAPACITY],
  ];
}

// 32 random bytes give 43 characters; the hosted server needs at least 32. Each create gets a new one.
export function newCookiePassword(): string {
  return randomBytes(32).toString('base64url');
}

export function shownVariables(variables: Variables): Variables {
  return variables.map(([key, value]) => [key, SECRET_KEYS.has(key) ? SECRET_SHOWN : value]);
}
