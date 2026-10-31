import { answerStream, tenantBodyOf, type StreamEnd } from './mcp-gateway-answer-stream.ts';
import { answerHeaders } from './mcp-gateway-headers.ts';

/** The failure of a tenant that restarts, before its first answer byte: HTTP 502, or a connection that resets. */
export type RestartCause = 'http-502' | 'connection';

export type TenantAnswer =
  | { readonly status: 'answered'; readonly response: Response; readonly ended: Promise<StreamEnd> }
  | { readonly status: 'restarted'; readonly cause: RestartCause };

export interface TenantCall {
  readonly target: URL;
  readonly method: string;
  readonly headers: Headers;
  readonly body?: Uint8Array;
}

const RESTARTED_CONNECTION: TenantAnswer = Object.freeze({ status: 'restarted', cause: 'connection' });

/**
 * Sends a forwarded request to the tenant over the private network and gives its answer as a stream that starts with
 * the first answer byte, so a failure of the tenant before that byte can still get an answer of the gateway. The abort
 * has two paths (record SO-01d): before the tenant answers, the signal aborts the pending fetch; after that, the abort
 * and a cancel of the client cancel the answer body of the tenant. An aborted call rejects with the reason of the signal.
 */
export async function callTenant(call: TenantCall, signal: AbortSignal): Promise<TenantAnswer> {
  let response: Response;
  try {
    response = await fetch(call.target, { method: call.method, headers: call.headers, body: call.body, signal, redirect: 'manual' });
  } catch {
    signal.throwIfAborted();
    return RESTARTED_CONNECTION;
  }
  if (response.status === 502) {
    await response.body?.cancel().catch(() => undefined);
    return { status: 'restarted', cause: 'http-502' };
  }
  return streamFrom(response, signal);
}

// The first read waits for the first answer byte. A tenant that goes away before it is a restart.
async function streamFrom(response: Response, signal: AbortSignal): Promise<TenantAnswer> {
  const init = { status: response.status, statusText: response.statusText, headers: answerHeaders(response.headers) };
  if (response.body === null) return { status: 'answered', response: new Response(null, init), ended: Promise.resolve('complete') };
  const ended = Promise.withResolvers<StreamEnd>();
  const body = tenantBodyOf(response.body.getReader(), signal, ended.resolve);
  const first = await body.reader.read().catch(() => undefined);
  if (first === undefined) {
    body.end('failed');
    signal.throwIfAborted();
    return RESTARTED_CONNECTION;
  }
  // The cancel of an abort ends the first read without a chunk.
  signal.throwIfAborted();
  return { status: 'answered', response: new Response(answerStream(body, first), init), ended: ended.promise };
}
