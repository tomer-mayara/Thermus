import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { InMemoryTransport, SdkErrorCode, type Transport } from '@modelcontextprotocol/client';
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { connectMcpClient, type McpClientOptions } from '../../support/drivers/mcp/mcp-sdk-client.ts';

function serveEchoTool(t: TestContext, transport: Transport, supportedProtocolVersions?: string[]): void {
  const handle = serveStdio(() => {
    const server = new McpServer({ name: 'driver-test-server', version: '0.0.0' }, { supportedProtocolVersions });
    server.registerTool('echo', { description: 'Gives a fixed text.' }, () => ({ content: [{ type: 'text', text: 'echo' }] }));
    return server;
  }, { transport });
  t.after(() => handle.close());
}

const silentServerCases: { label: string; options: McpClientOptions; stop: string; timeoutMs: number }[] = [
  { label: 'the defaults', options: {}, stop: 'after the default connect timeout of 5,000 ms', timeoutMs: 5_000 },
  { label: 'a connect timeout of 10,000 ms', options: { timeoutMs: 10_000 }, stop: 'after 10,000 ms', timeoutMs: 10_000 },
  { label: 'probe: true and a connect timeout of 10,000 ms', options: { probe: true, timeoutMs: 10_000 }, stop: 'after its own 5,000 ms', timeoutMs: 5_000 },
];

describe('The MCP SDK client driver', () => {
  test('Given an SDK server, when the driver connects with the defaults, then the client uses protocol version 2026-07-28 and lists the tools of the server', async (t) => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    serveEchoTool(t, serverTransport);

    const client = await connectMcpClient(t, clientTransport);
    t.after(() => client.close());

    assert.equal(client.getNegotiatedProtocolVersion(), '2026-07-28');
    assert.deepEqual((await client.listTools()).tools.map(({ name }) => name), ['echo']);
  });

  test('Given an SDK server, when the driver connects in the era 2025-11-25, then the legacy negotiation of the SDK gives protocol version 2025-11-25 and the client lists the tools of the server', async (t) => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    serveEchoTool(t, serverTransport);

    const client = await connectMcpClient(t, clientTransport, { era: '2025-11-25' });
    t.after(() => client.close());

    assert.equal(client.getNegotiatedProtocolVersion(), '2025-11-25');
    assert.deepEqual((await client.listTools()).tools.map(({ name }) => name), ['echo']);
  });

  for (const { label, options, stop, timeoutMs } of silentServerCases) {
    test(`Given a server that does not answer, when the driver connects with ${label}, then the version probe stops ${stop} and the connection fails`, { timeout: 5_000 }, async (t) => {
      t.mock.timers.enable({ apis: ['setTimeout'] });
      const [clientTransport] = InMemoryTransport.createLinkedPair();

      const refused = assert.rejects(connectMcpClient(t, clientTransport, options), { name: 'SdkError', code: SdkErrorCode.RequestTimeout, data: { timeout: timeoutMs } });
      await setImmediate();
      t.mock.timers.tick(timeoutMs);
      await refused;
    });
  }

  test('Given an SDK server that offers only protocol version 2025-06-18, when the driver connects in the era 2025-11-25, then the era check fails and the driver closes the client', async (t) => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    serveEchoTool(t, serverTransport, ['2025-06-18']);
    let closes = 0;
    clientTransport.onclose = () => { closes += 1; };

    await assert.rejects(connectMcpClient(t, clientTransport, { era: '2025-11-25' }), { name: 'AssertionError', actual: '2025-06-18', expected: '2025-11-25' });

    assert.equal(closes, 1);
  });

  test('Given an SDK server that offers only protocol version 2025-06-18, when the driver connects in the era 2025-11-25 with checkEra: false, then the driver gives the client, which uses protocol version 2025-06-18', async (t) => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    serveEchoTool(t, serverTransport, ['2025-06-18']);

    const client = await connectMcpClient(t, clientTransport, { era: '2025-11-25', checkEra: false });
    t.after(() => client.close());

    assert.equal(client.getNegotiatedProtocolVersion(), '2025-06-18');
  });
});
