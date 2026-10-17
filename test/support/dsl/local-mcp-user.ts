import type { TestContext } from 'node:test';
import { StreamableHTTPClientTransport, UnauthorizedError, type Client } from '@modelcontextprotocol/client';
import { PreRegisteredNativeClient } from '../drivers/browser/better-auth-agents.ts';
import { mcpResourceUrl, publicBaseUrl, type AccountCredentials } from '../in-process/better-auth-local.ts';
import { LocalBrowser, serverFetch, type ServerAddress } from '../drivers/browser/local-browser.ts';
import { userGrant, type UserGrant } from './local-commands.ts';
import { withRuntime } from '../in-process/local-runtime.ts';
import type { McpProtocolEra } from '../drivers/mcp/mcp-protocol-eras.ts';
import { connectMcpClient } from '../drivers/mcp/mcp-sdk-client.ts';
import { PreRegisteredSdkClient } from '../drivers/mcp/mcp-sdk-oauth-client.ts';

export interface McpConnection {
  readonly client: Client;
  // The bundled pages that the user saw before the client got its token; empty when no authorization was needed.
  readonly pages: readonly string[];
}

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
  async connect(t: TestContext, account: AccountCredentials = this.account, era: McpProtocolEra = '2026-07-28'): Promise<McpConnection> {
    const first = this.transport();
    try {
      return { client: await connectedClient(t, first, era), pages: [] };
    } catch (error) {
      if (!(error instanceof UnauthorizedError)) throw error;
    }
    const { callback, pages } = await this.browser.authorize(this.authorizationUrl(), account);
    await first.finishAuth(callback.searchParams);
    return { client: await connectedClient(t, this.transport(), era), pages };
  }

  // Connects with the saved token only. A refused token gives UnauthorizedError and prepares a new authorization URL.
  async connectWithSavedToken(t: TestContext, era: McpProtocolEra = '2026-07-28'): Promise<Client> {
    return connectedClient(t, this.transport(), era);
  }

  authorizationUrl(): URL {
    return new URL(this.oauth.authorizationPath(), publicBaseUrl);
  }

  private transport(): StreamableHTTPClientTransport {
    return new StreamableHTTPClientTransport(new URL(mcpResourceUrl), { authProvider: this.oauth, fetch: this.fetch });
  }
}

// Real tokens from the provider's own sign-in, consent, and token exchange, made while the server is stopped.
// Each grant uses its own client address, so the sign-in limit of the bundled pages does not apply.
export async function issuedGrants(directory: string, clientId: string, accounts: readonly AccountCredentials[]): Promise<ReadonlyMap<string, UserGrant>> {
  return withRuntime(directory, async (runtime) => {
    const native = new PreRegisteredNativeClient(runtime.auth, clientId);
    const grants = new Map<string, UserGrant>();
    for (const account of accounts) grants.set(account.email, await userGrant(runtime.auth, native, account));
    return grants;
  });
}

// An SDK client that sends the current value of token() as its Bearer token, so a test can change the token between calls.
export async function connectWithToken(t: TestContext, connection: { server: ServerAddress; token: () => string; era?: McpProtocolEra }): Promise<Client> {
  const transport = new StreamableHTTPClientTransport(new URL(mcpResourceUrl), {
    authProvider: { token: async () => connection.token() },
    fetch: serverFetch(connection.server),
  });
  return connectedClient(t, transport, connection.era ?? '2026-07-28');
}

async function connectedClient(t: TestContext, transport: StreamableHTTPClientTransport, era: McpProtocolEra): Promise<Client> {
  const client = await connectMcpClient(t, transport, { era, probe: true, timeoutMs: 10_000 });
  t.after(() => client.close());
  return client;
}
