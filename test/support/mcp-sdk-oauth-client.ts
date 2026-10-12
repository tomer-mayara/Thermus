import assert from 'node:assert/strict';
import type { OAuthClientProvider, OAuthDiscoveryState, StoredOAuthTokens } from '@modelcontextprotocol/client';
import { HttpAgent, loopbackRedirectUri } from './better-auth-agents.ts';
import { clientAddressHeader, publicBaseUrl, type LocalAuth } from './better-auth-local.ts';

export function sdkFetch(auth: LocalAuth) {
  const address = new HttpAgent(auth).address;
  return async (url: string | URL, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers);
    headers.set(clientAddressHeader, address);
    return auth.handler(new Request(url, { ...init, headers }));
  };
}

export class PreRegisteredSdkClient implements OAuthClientProvider {
  private readonly clientId: string;
  private storedTokens?: StoredOAuthTokens;
  private verifier = '';
  private discovery?: OAuthDiscoveryState;
  private pendingAuthorization?: URL;

  constructor(clientId: string) {
    this.clientId = clientId;
  }

  get redirectUrl(): string {
    return loopbackRedirectUri;
  }

  get clientMetadata() {
    return {
      client_name: 'Native MCP client',
      redirect_uris: [loopbackRedirectUri],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    };
  }

  clientInformation() {
    return { client_id: this.clientId };
  }

  tokens(): StoredOAuthTokens | undefined {
    return this.storedTokens;
  }

  saveTokens(tokens: StoredOAuthTokens): void {
    this.storedTokens = tokens;
  }

  redirectToAuthorization(authorizationUrl: URL): void {
    this.pendingAuthorization = authorizationUrl;
  }

  saveCodeVerifier(codeVerifier: string): void {
    this.verifier = codeVerifier;
  }

  codeVerifier(): string {
    return this.verifier;
  }

  saveDiscoveryState(state: OAuthDiscoveryState): void {
    this.discovery = state;
  }

  discoveryState(): OAuthDiscoveryState | undefined {
    return this.discovery;
  }

  authorizationPath(): string {
    assert.ok(this.pendingAuthorization, 'the SDK started no authorization');
    assert.equal(this.pendingAuthorization.origin, publicBaseUrl);
    return `${this.pendingAuthorization.pathname}${this.pendingAuthorization.search}`;
  }

  savedTokens(): StoredOAuthTokens {
    assert.ok(this.storedTokens, 'the SDK saved no tokens');
    return this.storedTokens;
  }

  expireAccessToken(): void {
    this.storedTokens = { ...this.savedTokens(), access_token: 'expired-access-token' };
  }
}
