import { Client, StreamableHTTPClientTransport, type CallToolResult } from '@modelcontextprotocol/client';

export const PROTOCOL_VERSION = '2026-07-28';
export const BEARER_TOKEN = 'probe-bearer-token';
export const FORGED_ACCESS = 'forged.forged';
const probeHopHeaders = { TE: 'trailers', Trailer: 'x-probe-trailer', 'Proxy-Probe': 'drop' };
export const PROBE_HOP_HEADERS = Object.keys(probeHopHeaders).map((name) => name.toLowerCase());

export interface CallRun { readonly startedAt: number; readonly progressAt: number[]; abortAt?: number; resultAt?: number; text?: string; error?: unknown }
interface DirectAnswer { readonly status: number; readonly type: string | null; readonly body: unknown }

export function newClient(): Client {
  return new Client({ name: 'gateway-probe-client', version: '0.0.0' }, { versionNegotiation: { mode: { pin: PROTOCOL_VERSION } } });
}

export async function connectClient(client: Client, proxy: URL): Promise<void> {
  await client.connect(new StreamableHTTPClientTransport(proxy, {
    authProvider: { token: async () => BEARER_TOKEN },
    requestInit: { headers: { ...probeHopHeaders, 'Thermus-Access': FORGED_ACCESS } },
  }), { timeout: 5_000 });
}

export async function timedCall(client: Client, label: string, abortAfterMs?: number): Promise<CallRun> {
  const controller = new AbortController();
  const run: CallRun = { startedAt: performance.now(), progressAt: [] };
  const timer = abortAfterMs === undefined ? undefined : setTimeout(() => {
    run.abortAt = performance.now();
    controller.abort();
  }, abortAfterMs);
  try {
    const result = await client.callTool({ name: 'slow', arguments: { label } }, {
      signal: controller.signal,
      onprogress: () => { run.progressAt.push(performance.now()); },
    });
    run.resultAt = performance.now();
    run.text = textOf(result);
  } catch (error) {
    run.error = error;
  } finally {
    clearTimeout(timer);
  }
  return run;
}

export async function directRequest(upstream: URL, header: string | undefined): Promise<DirectAnswer> {
  const headers = new Headers({ 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': PROTOCOL_VERSION });
  if (header !== undefined) headers.set('thermus-access', header);
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });
  const response = await fetch(new URL('/mcp', upstream), { method: 'POST', headers, body });
  return { status: response.status, type: response.headers.get('content-type'), body: jsonOrText(await response.text()) };
}

function textOf(result: CallToolResult): string | undefined {
  const [item] = result.content;
  return item?.type === 'text' ? item.text : undefined;
}

function jsonOrText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
