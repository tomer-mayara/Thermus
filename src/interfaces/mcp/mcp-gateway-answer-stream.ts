/**
 * How an answer stream ended: complete, cancelled by the client or by the shutdown, or failed because the tenant went
 * away after its first answer byte.
 */
export type StreamEnd = 'complete' | 'cancelled' | 'failed';

type ReadResult = Awaited<ReturnType<ReadableStreamDefaultReader<Uint8Array>['read']>>;

/** The answer body of a tenant: its reader, the signal of the forwarded request, and the end of the stream. */
interface TenantBody {
  readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  readonly signal: AbortSignal;
  readonly end: (how: StreamEnd) => void;
}

/** From the answer headers on, an abort of the request cancels the answer body of the tenant, and the stream ends one time. */
export function tenantBodyOf(reader: ReadableStreamDefaultReader<Uint8Array>, signal: AbortSignal, resolve: (how: StreamEnd) => void): TenantBody {
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

/**
 * The answer stream to the client, from the first answer byte of the tenant on. It reads one chunk of the tenant for
 * each pull of the client, so the gateway holds no answer. A cancel of the client cancels the answer body of the tenant.
 */
export function answerStream(body: TenantBody, first: ReadResult): ReadableStream<Uint8Array> {
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
