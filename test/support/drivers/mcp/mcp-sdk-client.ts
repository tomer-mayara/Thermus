import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { Client, type Transport } from '@modelcontextprotocol/client';
import { eraNegotiation, type McpProtocolEra } from './mcp-protocol-eras.ts';

export interface McpClientOptions {
  // The protocol era of the connection. The default is the modern era.
  readonly era?: McpProtocolEra;
  // Gives the version probe of the modern era its own timeout of 5,000 ms and no retry.
  // Without this option, the probe uses the connect timeout. The legacy era sends no probe.
  readonly probe?: boolean;
  // The connect timeout in milliseconds. The default is 5,000.
  readonly timeoutMs?: number;
  // Checks that the negotiated protocol version is the era. The default checks it.
  readonly checkEra?: boolean;
}

// This is the one place that builds and connects an SDK client for the tests. The transport stays with
// the caller, because its auth and its fetch differ. The caller closes the client, because the shutdown
// tests close it in a set order. If the connection or the era check fails, the caller gets no client.
// Then this function closes the client.
export async function connectMcpClient(t: TestContext, transport: Transport, options: McpClientOptions = {}): Promise<Client> {
  const { era = '2026-07-28', probe = false, timeoutMs = 5_000, checkEra = true } = options;
  const client = new Client({ name: 'thermus-test', version: '0.0.0' }, {
    versionNegotiation: { ...eraNegotiation(era), ...(probe ? { probe: { timeoutMs: 5_000, maxRetries: 0 } } : {}) },
  });
  try {
    await client.connect(transport, { signal: t.signal, timeout: timeoutMs });
    if (checkEra) assert.equal(client.getNegotiatedProtocolVersion(), era);
  } catch (error) {
    await client.close();
    throw error;
  }
  return client;
}
