import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { Client, InMemoryTransport, SERVER_INFO_META_KEY } from '@modelcontextprotocol/client';
import { MCPServer } from '../../../src/mcp/mcp-server.ts';

describe('MCPServer', () => {
  let server: MCPServer;

  beforeEach(() => {
    server = new MCPServer();
  });

  afterEach(async () => {
    await server.close();
  });

  test('Given the Magumagu MCP server, when a client connects and runs server/discover, then it advertises its identity and supported protocol', { timeout: 10_000 }, async (context) => {
    const protocolVersion = '2026-07-28';
    const client = new Client(
      { name: 'magumagu-test', version: '0.0.0' },
      {
        versionNegotiation: {
          mode: { pin: protocolVersion },
          probe: { timeoutMs: 5_000, maxRetries: 0 },
        },
      },
    );
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    context.after(async () => {
      await client.close();
    });

    await server.connect(serverTransport);
    await client.connect(clientTransport, { timeout: 5_000, signal: context.signal });
    const discovery = await client.discover({ timeout: 2_000, signal: context.signal });

    assert.ok(discovery.supportedVersions.includes(protocolVersion));
    assert.equal(discovery._meta?.[SERVER_INFO_META_KEY]?.name, 'magumagu');
  });
});
