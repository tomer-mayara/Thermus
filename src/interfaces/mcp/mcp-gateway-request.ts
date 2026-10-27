import { DEFAULT_MAX_REQUEST_BODY_SIZE } from '@modelcontextprotocol/server';
import { ACCESS_CONTEXT_HEADER } from '../../accounts/identity/signed-access-context.ts';

/**
 * One JSON-RPC message of a forwarded body, as far as the gateway reads it: its id, its method, and, for tools/call,
 * the tool name. The gateway reads nothing more of a body: no argument, no metadata, and no answer of the tenant.
 */
export interface ForwardedMessage {
  readonly id?: string | number;
  readonly method?: string;
  readonly toolName?: string;
}

/** The body that the gateway forwards: its bytes as the client sent them, and its messages. */
export interface ForwardedBody {
  readonly bytes?: Uint8Array;
  readonly messages: readonly ForwardedMessage[];
  readonly batch: boolean;
}

export type BodyRead = { readonly status: 'read'; readonly body: ForwardedBody } | { readonly status: 'too-large' };

const NO_BODY: ForwardedBody = Object.freeze({ messages: Object.freeze([]), batch: false });

// The hop-by-hop headers of RFC 9110, section 7.6.1, and the names that the Connection header lists: none of them may
// cross a proxy, and the fetch of Node refuses some of them (record SO-01d).
const HOP_BY_HOP = ['connection', 'keep-alive', 'proxy-connection', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'proxy-authenticate', 'proxy-authorization'];
// fetch sets the host and the length itself, and the signed context replaces each client value. A cookie of the
// control plane is one of its credentials, so it never reaches a tenant.
const SET_BY_GATEWAY = ['host', 'content-length', 'cookie', ACCESS_CONTEXT_HEADER.toLowerCase()];
// The fetch of Node decodes a compressed answer, so its length and its encoding no longer describe the body.
const SET_BY_BRIDGE = ['content-length', 'content-encoding'];

/**
 * Reads the body of a forwarded request within the request body limit of the MCP SDK, so the limit of today stays, and
 * reads its messages. The read stops at the abort of the signal.
 */
export async function readForwardedBody(request: Request, signal: AbortSignal): Promise<BodyRead> {
  if (request.body === null) return { status: 'read', body: NO_BODY };
  if (Number(request.headers.get('content-length')) > DEFAULT_MAX_REQUEST_BODY_SIZE) return { status: 'too-large' };
  const bytes = await boundedBytes(request.body, signal);
  return bytes === undefined ? { status: 'too-large' } : { status: 'read', body: { bytes, ...messagesOf(bytes) } };
}

/** The answer of the SDK to a body above its limit. */
export function tooLargeAnswer(): Response {
  const message = `Payload Too Large: Request body must not exceed ${DEFAULT_MAX_REQUEST_BODY_SIZE} bytes`;
  return Response.json({ jsonrpc: '2.0', error: { code: -32000, message }, id: null }, { status: 413 });
}

/** The headers that reach the tenant: those of the client without the hop-by-hop headers, with the signed context. */
export function tenantHeaders(headers: Headers, context: string): Headers {
  const forwarded = withoutHeaders(headers, [...HOP_BY_HOP, ...SET_BY_GATEWAY]);
  forwarded.set(ACCESS_CONTEXT_HEADER, context);
  return forwarded;
}

/** The headers of the answer of the tenant that reach the client. */
export function answerHeaders(headers: Headers): Headers {
  return withoutHeaders(headers, [...HOP_BY_HOP, ...SET_BY_BRIDGE]);
}

function withoutHeaders(headers: Headers, names: readonly string[]): Headers {
  const listed = (headers.get('connection') ?? '').split(',').map((name) => name.trim().toLowerCase());
  const dropped = new Set([...names, ...listed]);
  const kept = new Headers();
  for (const [name, value] of headers) if (!dropped.has(name)) kept.append(name, value);
  return kept;
}

async function boundedBytes(body: ReadableStream<Uint8Array>, signal: AbortSignal): Promise<Uint8Array | undefined> {
  const reader = body.getReader();
  const stop = (): void => { reader.cancel(signal.reason).catch(() => undefined); };
  signal.addEventListener('abort', stop, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      size += chunk.value.byteLength;
      if (size > DEFAULT_MAX_REQUEST_BODY_SIZE) {
        await reader.cancel();
        return undefined;
      }
      chunks.push(chunk.value);
    }
  } finally {
    signal.removeEventListener('abort', stop);
  }
  signal.throwIfAborted();
  return Buffer.concat(chunks);
}

// A body that is not JSON goes to the tenant as it is, and its answer comes from the tenant.
function messagesOf(bytes: Uint8Array): Pick<ForwardedBody, 'messages' | 'batch'> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return NO_BODY;
  }
  const messages: readonly unknown[] = Array.isArray(parsed) ? parsed : [parsed];
  return { messages: messages.map(messageOf), batch: Array.isArray(parsed) };
}

function messageOf(value: unknown): ForwardedMessage {
  if (typeof value !== 'object' || value === null) return {};
  const { id, method, params } = value as { readonly id?: unknown; readonly method?: unknown; readonly params?: { readonly name?: unknown } };
  const toolName = method === 'tools/call' && typeof params === 'object' && params !== null ? params.name : undefined;
  return {
    ...(typeof id === 'string' || typeof id === 'number' ? { id } : {}),
    ...(typeof method === 'string' ? { method } : {}),
    ...(typeof toolName === 'string' ? { toolName } : {}),
  };
}
