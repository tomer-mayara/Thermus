import assert from 'node:assert/strict';
import { visitAuthKit, type AuthKitVisit } from './authkit-driver.ts';
import { connectAuthorizationRequest, exchangeConnectCode, issuedTokens, type IssuedTokens } from './connect-client.ts';
import type { SignInServices } from './browser-session.ts';
import { connectRedirectUri, mcpResource } from './settings.ts';
import type { LiveUser } from './staging-fixtures.ts';

interface ConnectGrantRequest {
  readonly user: LiveUser;
  readonly organizationName?: string;
  readonly clientId: string;
}

export interface ConnectGrant {
  readonly visit: AuthKitVisit;
  readonly stateMatches: boolean;
  readonly tokens: IssuedTokens;
  readonly clientId: string;
}

// An MCP client authorization through Connect: hosted AuthKit asks for the sign-in, the MFA step, and the consent,
// and the client exchanges the code with its PKCE verifier and the MCP resource. The callback is intercepted.
export async function authorizeWithConnect(services: SignInServices, request: ConnectGrantRequest): Promise<ConnectGrant> {
  const { settings, browser } = services;
  const authorization = connectAuthorizationRequest(settings.authkitIssuer, request.clientId);
  const page = await browser.newPage();
  try {
    const authkitHost = new URL(settings.authkitIssuer).host;
    const visit = await visitAuthKit(page, authorization.url, { user: request.user, organizationName: request.organizationName, authkitHost, callback: connectRedirectUri });
    const code = visit.callback.searchParams.get('code');
    assert.ok(code, `The Connect callback has no authorization code. It has: ${[...visit.callback.searchParams.keys()].join(', ')}.`);
    const answer = await exchangeConnectCode(settings.authkitIssuer, request.clientId, { code, verifier: authorization.verifier, resource: mcpResource });
    const stateMatches = visit.callback.searchParams.get('state') === authorization.state;
    return { visit, stateMatches, tokens: issuedTokens(answer, 'The Connect code exchange'), clientId: request.clientId };
  } finally {
    await page.context().close();
  }
}
