/**
 * Reads the body of a request up to a limit in bytes. A body above the limit gives undefined: the read stops at the
 * first chunk past the limit, or before the first byte when the Content-Length is above it, and cancels the body, so
 * the server discards the unread bytes. An abort of the signal cancels the body, and the read rejects with the reason
 * of the signal. A request without a body gives an empty buffer.
 */
export async function readBoundedBody(request: Request, limit: number, signal: AbortSignal): Promise<Buffer | undefined> {
  signal.throwIfAborted();
  if (request.body === null) return Buffer.alloc(0);
  if (Number(request.headers.get('content-length')) > limit) {
    await request.body.cancel();
    return undefined;
  }
  return boundedBytes(request.body.getReader(), limit, signal);
}

// A client that disconnects or a shutdown aborts the signal. The cancel then ends a pending read, so a body that the
// client stops sending cannot keep the read open.
async function boundedBytes(reader: ReadableStreamDefaultReader<Uint8Array>, limit: number, signal: AbortSignal): Promise<Buffer | undefined> {
  const stop = (): void => { reader.cancel(signal.reason).catch(() => undefined); };
  signal.addEventListener('abort', stop, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      size += chunk.value.byteLength;
      if (size > limit) {
        await reader.cancel();
        return undefined;
      }
      chunks.push(chunk.value);
    }
  } finally {
    signal.removeEventListener('abort', stop);
  }
  // The cancel of an abort ends the read without a chunk.
  signal.throwIfAborted();
  return Buffer.concat(chunks);
}
