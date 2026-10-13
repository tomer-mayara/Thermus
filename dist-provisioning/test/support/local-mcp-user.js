import { Client, StreamableHTTPClientTransport, UnauthorizedError } from '@modelcontextprotocol/client';
import { mcpResourceUrl, publicBaseUrl } from './better-auth-local.js';
import { LocalBrowser, serverFetch } from './local-browser.js';
import { PreRegisteredSdkClient } from './mcp-sdk-oauth-client.js';
// One user with a browser and the tested MCP client: the MCP TypeScript SDK client with a pre-registered native client ID.
export class LocalMcpUser {
    account;
    browser;
    oauth;
    fetch;
    constructor(server, clientId, account) {
        this.account = account;
        this.browser = new LocalBrowser(server);
        this.oauth = new PreRegisteredSdkClient(clientId);
        this.fetch = serverFetch(server);
    }
    get accessToken() {
        return this.oauth.savedTokens().access_token;
    }
    // Connects as the SDK documents: a refused connection starts the authorization, the user completes it
    // in the browser, finishAuth exchanges the code, and a new connection uses the new token.
    async connect(t, account = this.account) {
        const first = this.transport();
        try {
            return { client: await this.connected(t, first), pages: [] };
        }
        catch (error) {
            if (!(error instanceof UnauthorizedError))
                throw error;
        }
        const { callback, pages } = await this.browser.authorize(this.authorizationUrl(), account);
        await first.finishAuth(callback.searchParams);
        return { client: await this.connected(t, this.transport()), pages };
    }
    // Connects with the saved token only. A refused token gives UnauthorizedError and prepares a new authorization URL.
    async connectWithSavedToken(t) {
        return this.connected(t, this.transport());
    }
    authorizationUrl() {
        return new URL(this.oauth.authorizationPath(), publicBaseUrl);
    }
    transport() {
        return new StreamableHTTPClientTransport(new URL(mcpResourceUrl), { authProvider: this.oauth, fetch: this.fetch });
    }
    async connected(t, transport) {
        const client = new Client({ name: 'magumagu-acceptance', version: '0.0.0' }, { versionNegotiation: { mode: { pin: '2026-07-28' }, probe: { timeoutMs: 5_000, maxRetries: 0 } } });
        t.after(() => client.close());
        await client.connect(transport, { timeout: 10_000, signal: t.signal });
        return client;
    }
}
//# sourceMappingURL=local-mcp-user.js.map