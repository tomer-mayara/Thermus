import { DEFAULT_MAX_REQUEST_BODY_SIZE } from '@modelcontextprotocol/server';
import { readBoundedBody } from '../../runtime/http/bounded-body.ts';

/**
 * One JSON-RPC message of a forwarded body, as far as the gateway reads it: its id, its method, and, for tools/call,
 * the tool name. The gateway reads nothing more of a body: no argument, no metadata, and no answer of the tenant.
 */
export interface ForwardedMessage {
  readonly id?: string | number;
  readonly method?: string;
  readonly toolName?: string;
}

export interface ForwardedBody {
  readonly bytes?: Uint8Array;
  readonly messages: readonly ForwardedMessage[];
  readonly batch: boolean;
}

type BodyRead = { readonly status: 'read'; readonly body: ForwardedBody } | { readonly status: 'too-large' };

const NO_BODY: ForwardedBody = Object.freeze({ messages: Object.freeze([]), batch: false });

/**
 * Reads the body of a forwarded request within the request body limit of the MCP SDK, so the limit of today stays, and
 * reads its messages. The read stops at the abort of the signal.
 */
export async function readForwardedBody(request: Request, signal: AbortSignal): Promise<BodyRead> {
  if (request.body === null) return { status: 'read', body: NO_BODY };
  const bytes = await readBoundedBody(request, DEFAULT_MAX_REQUEST_BODY_SIZE, signal);
  return bytes === undefined ? { status: 'too-large' } : { status: 'read', body: { bytes, ...messagesOf(bytes) } };
}

export function tooLargeAnswer(): Response {
  const message = `Payload Too Large: Request body must not exceed ${DEFAULT_MAX_REQUEST_BODY_SIZE} bytes`;
  return Response.json({ jsonrpc: '2.0', error: { code: -32000, message }, id: null }, { status: 413 });
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
