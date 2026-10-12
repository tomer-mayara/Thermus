import assert from 'node:assert/strict';
import {
  CLIENT_CAPABILITIES_META_KEY,
  CLIENT_INFO_META_KEY,
  PROTOCOL_VERSION_META_KEY,
} from '@modelcontextprotocol/server';

const protocolVersion = '2026-07-28';

export interface McpRequestOptions {
  readonly url: string;
  readonly method: 'server/discover' | 'tools/list' | 'tools/call';
  readonly token?: string;
  readonly params?: Readonly<Record<string, unknown>>;
  readonly headers?: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
}

export function mcpRequest(options: McpRequestOptions): Request {
  const headers = new Headers({
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'MCP-Protocol-Version': protocolVersion,
    'Mcp-Method': options.method,
    ...options.headers,
  });
  if (options.token !== undefined) headers.set('Authorization', `Bearer ${options.token}`);
  if (options.method === 'tools/call') headers.set('Mcp-Name', String(options.params?.name));
  const params = {
    _meta: {
      [PROTOCOL_VERSION_META_KEY]: protocolVersion,
      [CLIENT_INFO_META_KEY]: { name: 'magumagu-test', version: '0.0.0' },
      [CLIENT_CAPABILITIES_META_KEY]: {},
    },
    ...options.params,
  };
  return new Request(options.url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: options.method, params }),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  });
}

export async function rpcResult(response: Response): Promise<Record<string, unknown>> {
  const body = await response.text();
  const data = response.headers.get('Content-Type')?.startsWith('text/event-stream')
    ? body.split('\n').find((line) => line.startsWith('data: '))?.slice(6)
    : body;
  assert.ok(data, `response has no JSON-RPC message: ${body}`);
  const message = JSON.parse(data);
  assert.ok(message.result, `response has no JSON-RPC result: ${data}`);
  return message.result;
}

export async function toolJson<T>(response: Response): Promise<T> {
  assert.equal(response.status, 200);
  const result = await rpcResult(response);
  assert.notEqual(result.isError, true, JSON.stringify(result.content));
  const [content] = result.content as Array<{ type: string; text: string }>;
  assert.equal(content?.type, 'text');
  return JSON.parse(content.text);
}
