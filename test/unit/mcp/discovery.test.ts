import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client, SERVER_INFO_META_KEY } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

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
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('../../../src/index.js', import.meta.url))],
  });
  context.after(async () => {
    try {
      await client.close();
    } finally {
      await transport.close();
    }
  });

  await client.connect(transport, { timeout: 5_000, signal: context.signal });
  const discovery = await client.discover({ timeout: 2_000, signal: context.signal });

  assert.ok(discovery.supportedVersions.includes(protocolVersion));
  assert.equal(discovery._meta?.[SERVER_INFO_META_KEY]?.name, 'magumagu');
});
