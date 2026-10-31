// The MCP call of the rehearsal: getURLAsMarkdown with https://example.com/ on the MCP endpoint of the staging control
// plane, with a Connect token. A tap on fetch records each HTTP answer that is not 2xx, with its Retry-After header and
// the error words, so a refusal of the gateway (503 with Retry-After) shows as it came.
import { Client, StreamableHTTPClientTransport, type CallToolResult } from '@modelcontextprotocol/client';
import { errorOutcome } from '../../spike/capacity-probe/mcp.ts';
import { PROTOCOL_VERSION } from '../../spike/gateway-proxy/client.ts';
import { utcNow } from './rehearsal-settings.ts';

const TARGET = 'https://example.com/';
const MARKER = 'Example Domain';
const REASON = 'Rehearse the SO-12 release of the free tier on the staging control plane';
const CALL_TIMEOUT_MS = 120_000;
const CONNECT_TIMEOUT_MS = 30_000;
const WORDS_LIMIT = 200;

interface Refusal {
  readonly status: number;
  readonly retryAfter: string | null;
  readonly words: string;
}

export interface CallResult {
  readonly at: string;
  readonly ms: number;
  readonly answered: boolean;
  readonly text: string;
  readonly refusals: readonly Refusal[];
}

function wordsOf(body: string): string {
  try {
    const json = JSON.parse(body) as { error_description?: unknown; error?: unknown };
    if (typeof json.error_description === 'string') return `${String(json.error)}: ${json.error_description}`;
  } catch { /* not JSON */ }
  return body.slice(0, WORDS_LIMIT);
}

function tapFetch(refusals: Refusal[]): typeof fetch {
  return async (input, init) => {
    const response = await fetch(input, init);
    if (response.status >= 300) refusals.push({ status: response.status, retryAfter: response.headers.get('retry-after'), words: wordsOf(await response.clone().text()) });
    return response;
  };
}

function resultText(result: CallToolResult): { readonly answered: boolean; readonly text: string } {
  const text = result.content.flatMap((item) => (item.type === 'text' ? [item.text] : [])).join('');
  if (result.isError === true) return { answered: false, text: `tool error: ${text.slice(0, WORDS_LIMIT)}` };
  const found = text.includes(MARKER);
  return { answered: found, text: `answer of ${text.length} characters; "${MARKER}" ${found ? 'present' : 'absent'}` };
}

/** One call: connect, then tools/call. A refusal, a transport error, or a tool error gives answered false. */
export async function callOnce(endpoint: URL, token: string): Promise<CallResult> {
  const at = utcNow();
  const started = performance.now();
  const refusals: Refusal[] = [];
  const client = new Client({ name: 'thermus-so12-rehearsal', version: '0.0.0' }, { versionNegotiation: { mode: { pin: PROTOCOL_VERSION } } });
  try {
    await client.connect(new StreamableHTTPClientTransport(endpoint, { authProvider: { token: async () => token }, fetch: tapFetch(refusals) }), { timeout: CONNECT_TIMEOUT_MS });
    const result = await client.callTool({ name: 'getURLAsMarkdown', arguments: { url: TARGET, reason: REASON } }, { timeout: CALL_TIMEOUT_MS }) as CallToolResult;
    return { at, ms: performance.now() - started, ...resultText(result), refusals };
  } catch (error) {
    return { at, ms: performance.now() - started, answered: false, text: errorOutcome(error), refusals };
  } finally {
    await client.close().catch(() => undefined);
  }
}

export function callLine(result: CallResult): string {
  const refusals = result.refusals.map((refusal) => `HTTP ${refusal.status}, Retry-After ${refusal.retryAfter ?? 'absent'}, "${refusal.words}"`).join(' | ');
  return `${result.at} ${(result.ms / 1_000).toFixed(1)} s: ${result.text}${refusals === '' ? '' : `; ${refusals}`}`;
}
