import { McpServer, type Transport } from '@modelcontextprotocol/server';
import { serveStdio, type StdioServerHandle } from '@modelcontextprotocol/server/stdio';

export class MCPServer {
  private connection?: StdioServerHandle;

  connect(transport: Transport): void {
    this.connection = serveStdio(
      () => new McpServer({ name: 'magumagu', version: '0.0.0' }),
      { transport },
    );
  }

  close(): Promise<void> {
    return this.connection?.close() ?? Promise.resolve();
  }
}
