import { answerHeaders } from './mcp-gateway-request.ts';

// How an answer stream ended: complete, cancelled by the client or by the shutdown, or failed because the tenant went
// away after its first answer byte.
type StreamEnd = 'complete' | 'cancelled' | 'failed';

/** The failure of a tenant that restarts, before its first answer byte: HTTP 502, or a connection that resets. */
export type RestartCause = 'http-502' | 'connection';

export type TenantAnswer =
  | { readonly status: 'answered'; readonly response: Response; readonly ended: Promise<StreamEnd> }
  | { readonly status: 'restarted'; readonly cause: RestartCause };

/** One forwarded request to the internal address of a tenant. */
export interface TenantCall {
  readonly target: URL;
  readonly method: string;
  readonly headers: Headers;
  readonly body?: Uint8Array;
}

// The answer body of a tenant: its reader, the signal of the forwarded request, and the end of the stream.
interface TenantBody {
  readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  readonly signal: AbortSignal;
  readonly end: (how: StreamEnd) => void;
}

type ReadResult = Awaited<ReturnType<ReadableStreamDefaultReader<Uint8Array>['read']>>;

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

async function streamFrom(response: Response, signal: AbortSignal): Promise<TenantAnswer> {
  const init = { status: response.status, statusText: response.statusText, headers: answerHeaders(response.headers) };
  if (response.body === null) return { status: 'answered', response: new Response(null, init), ended: Promise.resolve('complete') };
  const ended = Promise.withResolvers<StreamEnd>();
  const body = bodyOf(response.body.getReader(), signal, ended.resolve);
  let first: ReadResult;
  try {
    first = await body.reader.read();
  } catch {
    body.end('failed');
    signal.throwIfAborted();
    return RESTARTED_CONNECTION;
  }
  // The cancel of an abort ends the first read without a chunk.
  signal.throwIfAborted();
  return { status: 'answered', response: new Response(answerStream(body, first), init), ended: ended.promise };
}

// From the answer headers on, an abort of the request cancels the answer body of the tenant, and the stream ends once.
function bodyOf(reader: ReadableStreamDefaultReader<Uint8Array>, signal: AbortSignal, resolve: (how: StreamEnd) => void): TenantBody {
  const abort = (): void => {
    end('cancelled');
    reader.cancel(signal.reason).catch(() => undefined);
  };
  const end = (how: StreamEnd): void => {
    signal.removeEventListener('abort', abort);
    resolve(how);
  };
  signal.addEventListener('abort', abort, { once: true });
  return { reader, signal, end };
}

function answerStream(body: TenantBody, first: ReadResult): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      if (!first.done) controller.enqueue(first.value);
      else finish(controller, body, 'complete');
    },
    async pull(controller) {
      try {
        const next = await body.reader.read();
        if (!next.done) controller.enqueue(next.value);
        else finish(controller, body, 'complete');
      } catch {
        // After the first answer byte, the gateway ends a stream that the tenant broke off (answer 1 of 27 October 2026).
        finish(controller, body, body.signal.aborted ? 'cancelled' : 'failed');
      }
    },
    cancel(reason) {
      body.end('cancelled');
      return body.reader.cancel(reason);
    },
  }, { highWaterMark: 0 });
}

function finish(controller: ReadableStreamDefaultController<Uint8Array>, body: TenantBody, how: StreamEnd): void {
  try {
    controller.close();
  } catch {
    // The client cancelled the stream already.
  }
  body.end(how);
}
