import assert from 'node:assert/strict';
import { HttpAgent, loopbackRedirectUri } from './better-auth-agents.js';
import { clientAddressHeader, publicBaseUrl } from './better-auth-local.js';
export function sdkFetch(auth) {
    const address = new HttpAgent(auth).address;
    return async (url, init) => {
        const headers = new Headers(init?.headers);
        headers.set(clientAddressHeader, address);
        return auth.handler(new Request(url, { ...init, headers }));
    };
}
export class PreRegisteredSdkClient {
    clientId;
    storedTokens;
    verifier = '';
    discovery;
    pendingAuthorization;
    constructor(clientId) {
        this.clientId = clientId;
    }
    get redirectUrl() {
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
    tokens() {
        return this.storedTokens;
    }
    saveTokens(tokens) {
        this.storedTokens = tokens;
    }
    redirectToAuthorization(authorizationUrl) {
        this.pendingAuthorization = authorizationUrl;
    }
    saveCodeVerifier(codeVerifier) {
        this.verifier = codeVerifier;
    }
    codeVerifier() {
        return this.verifier;
    }
    saveDiscoveryState(state) {
        this.discovery = state;
    }
    discoveryState() {
        return this.discovery;
    }
    authorizationPath() {
        assert.ok(this.pendingAuthorization, 'the SDK started no authorization');
        assert.equal(this.pendingAuthorization.origin, publicBaseUrl);
        return `${this.pendingAuthorization.pathname}${this.pendingAuthorization.search}`;
    }
    savedTokens() {
        assert.ok(this.storedTokens, 'the SDK saved no tokens');
        return this.storedTokens;
    }
    expireAccessToken() {
        this.storedTokens = { ...this.savedTokens(), access_token: 'expired-access-token' };
    }
}
//# sourceMappingURL=mcp-sdk-oauth-client.js.map