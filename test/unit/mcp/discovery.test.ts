import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { InMemoryTransport, SERVER_INFO_META_KEY } from '@modelcontextprotocol/client';
import { MCPServer } from '../../../src/mcp/mcp-server.ts';
import { connectMcpClient } from '../../support/drivers/mcp/mcp-sdk-client.ts';

describe('MCPServer', () => {
  let server: MCPServer;

  beforeEach(() => {
    server = new MCPServer();
  });

  afterEach(async () => {
    await server.close();
  });

  test('Given the Thermus MCP server, when a client connects and runs server/discover, then it advertises its identity and supported protocol', { timeout: 10_000 }, async (context) => {
    const protocolVersion = '2026-07-28';
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);
    const client = await connectMcpClient(context, clientTransport, { probe: true, checkEra: false });
    context.after(async () => {
      await client.close();
    });
    const discovery = await client.discover({ timeout: 2_000, signal: context.signal });

    assert.ok(discovery.supportedVersions.includes(protocolVersion));
    assert.equal(discovery._meta?.[SERVER_INFO_META_KEY]?.name, 'thermus');
  });
});
