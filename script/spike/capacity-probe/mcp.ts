import { Client, SdkError, SdkHttpError, StreamableHTTPClientTransport, type CallToolResult } from '@modelcontextprotocol/client';
import { PROTOCOL_VERSION } from '../gateway-proxy/client.ts';
import type { TokenProvider } from './context.ts';
import type { Workload } from './inputs.ts';
import { PAGES } from './pages.ts';

// The tool names and inputs of docs/reference/mcp-fetch-tool.md and docs/reference/mcp-search-tool.md.
export const FETCH_TOOL = 'getURLAsMarkdown';
export const SEARCH_TOOL = 'search';
const SEARCH_QUERY = 'Lightpanda browser documentation';
const CALL_REASON = 'Measure the memory and capacity of a hosted tenant service (SO-01e probe)';
const BUSY_TEXT = 'Server busy. Try again later.';
// The renderer has a 60 s process limit, but the cleaning of a 9 MiB page has none, so a call can take minutes on a
// starved instance. The client gives each call 5 minutes.
const CALL_TIMEOUT_MS = 300_000;
const CONNECT_TIMEOUT_MS = 30_000;
const TEXT_LIMIT = 100;
const SEARCH_RESULT = /\]\(https?:\/\//;

export interface ToolCall {
  readonly name: string;
  readonly arguments: Readonly<Record<string, string>>;
  readonly marker: string;
  found(text: string): boolean;
}

export interface CallOutcome {
  readonly outcome: string;
  readonly ok: boolean;
  readonly ms: number;
  readonly chars: number;
}

export function workloadCall(workload: Workload, pagesOrigin: string): ToolCall {
  if (workload === 'search') {
    return { name: SEARCH_TOOL, arguments: { query: SEARCH_QUERY, reason: CALL_REASON }, marker: 'a result link', found: (text) => SEARCH_RESULT.test(text) };
  }
  const page = PAGES[workload];
  return { name: FETCH_TOOL, arguments: { url: `${pagesOrigin}${page.path}`, reason: CALL_REASON }, marker: page.marker, found: (text) => text.includes(page.marker) };
}

// One client for each call, as one agent each, pinned to the protocol of the SO-01d part one client.
export async function connectTenant(endpoint: URL, tokens: TokenProvider): Promise<Client> {
  const client = new Client({ name: 'thermus-capacity-probe', version: '0.0.0' }, { versionNegotiation: { mode: { pin: PROTOCOL_VERSION } } });
  await client.connect(new StreamableHTTPClientTransport(endpoint, { authProvider: { token: () => tokens.token() } }), { timeout: CONNECT_TIMEOUT_MS });
  return client;
}

function textOf(result: CallToolResult): string {
  return result.content.flatMap((item) => (item.type === 'text' ? [item.text] : [])).join('');
}

// The tool errors are fixed public texts (the failure tables of the two references), so the probe records them.
function resultOutcome(result: CallToolResult, call: ToolCall): Omit<CallOutcome, 'ms'> {
  const text = textOf(result);
  if (result.isError === true) {
    const outcome = text === BUSY_TEXT ? 'busy' : `error: ${text.slice(0, TEXT_LIMIT)}`;
    return { outcome, ok: false, chars: text.length };
  }
  const found = call.found(text);
  return { outcome: found ? 'ok' : 'ok, no marker', ok: found, chars: text.length };
}

function causeCode(error: unknown): string | undefined {
  const cause = error instanceof Error ? error.cause : undefined;
  return cause instanceof Error && 'code' in cause && typeof cause.code === 'string' ? cause.code : undefined;
}

export function errorOutcome(error: unknown): string {
  if (SdkHttpError.isInstance(error)) return `HTTP ${error.status}`;
  if (SdkError.isInstance(error)) return String(error.code) === 'REQUEST_TIMEOUT' ? 'client timeout' : `client ${String(error.code)}`;
  const code = causeCode(error);
  if (code !== undefined) return `network ${code}`;
  return `client ${error instanceof Error ? error.name : 'error'}`;
}

export async function timedCall(client: Client, call: ToolCall, signal: AbortSignal): Promise<CallOutcome> {
  const started = performance.now();
  try {
    const result = await client.callTool({ name: call.name, arguments: { ...call.arguments } }, { timeout: CALL_TIMEOUT_MS, signal });
    return { ...resultOutcome(result, call), ms: performance.now() - started };
  } catch (error) {
    if (signal.aborted) throw error;
    return { outcome: errorOutcome(error), ok: false, ms: performance.now() - started, chars: 0 };
  }
}
