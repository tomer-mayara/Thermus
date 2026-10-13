import type { TestContext } from 'node:test';
import { Client, StreamableHTTPClientTransport, UnauthorizedError } from '@modelcontextprotocol/client';
import { mcpResourceUrl, publicBaseUrl, type AccountCredentials } from './better-auth-local.ts';
import { LocalBrowser, serverFetch, type ServerAddress } from './local-browser.ts';
import { PreRegisteredSdkClient } from './mcp-sdk-oauth-client.ts';

export interface McpConnection {
  readonly client: Client;
  // The bundled pages that the user saw before the client got its token; empty when no authorization was needed.
  readonly pages: readonly string[];
}

// One user with a browser and the tested MCP client: the MCP TypeScript SDK client with a pre-registered native client ID.
export class LocalMcpUser {
  readonly account: AccountCredentials;
  readonly browser: LocalBrowser;
  readonly oauth: PreRegisteredSdkClient;
  private readonly fetch: ReturnType<typeof serverFetch>;

  constructor(server: ServerAddress, clientId: string, account: AccountCredentials) {
    this.account = account;
    this.browser = new LocalBrowser(server);
    this.oauth = new PreRegisteredSdkClient(clientId);
    this.fetch = serverFetch(server);
  }

  get accessToken(): string {
    return this.oauth.savedTokens().access_token;
  }

  // Connects as the SDK documents: a refused connection starts the authorization, the user completes it
  // in the browser, finishAuth exchanges the code, and a new connection uses the new token.
  async connect(t: TestContext, account: AccountCredentials = this.account): Promise<McpConnection> {
    const first = this.transport();
    try {
      return { client: await this.connected(t, first), pages: [] };
    } catch (error) {
      if (!(error instanceof UnauthorizedError)) throw error;
    }
    const { callback, pages } = await this.browser.authorize(this.authorizationUrl(), account);
    await first.finishAuth(callback.searchParams);
    return { client: await this.connected(t, this.transport()), pages };
  }

  // Connects with the saved token only. A refused token gives UnauthorizedError and prepares a new authorization URL.
  async connectWithSavedToken(t: TestContext): Promise<Client> {
    return this.connected(t, this.transport());
  }

  authorizationUrl(): URL {
    return new URL(this.oauth.authorizationPath(), publicBaseUrl);
  }

  private transport(): StreamableHTTPClientTransport {
    return new StreamableHTTPClientTransport(new URL(mcpResourceUrl), { authProvider: this.oauth, fetch: this.fetch });
  }

  private async connected(t: TestContext, transport: StreamableHTTPClientTransport): Promise<Client> {
    const client = new Client(
      { name: 'magumagu-acceptance', version: '0.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' }, probe: { timeoutMs: 5_000, maxRetries: 0 } } },
    );
    t.after(() => client.close());
    await client.connect(transport, { timeout: 10_000, signal: t.signal });
    return client;
  }
}
