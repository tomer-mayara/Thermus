import { messagePage } from './local-auth-page-html.ts';

export const FORM_LIMIT = 16 * 1024;

export async function readForm(request: Request): Promise<URLSearchParams | Response> {
  const contentType = request.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase();
  if (contentType !== 'application/x-www-form-urlencoded') return messagePage(415, 'This page accepts only HTML form data.');
  const length = request.headers.get('Content-Length');
  if (length !== null && Number(length) > FORM_LIMIT) {
    await request.body?.cancel();
    return tooLarge();
  }
  if (request.body === null) return new URLSearchParams();
  return readBody(request.body, request.signal);
}

async function readBody(body: ReadableStream<Uint8Array>, signal: AbortSignal): Promise<URLSearchParams | Response> {
  const reader = body.getReader();
  const cancelOnAbort = () => { void reader.cancel(signal.reason).catch(() => undefined); };
  signal.addEventListener('abort', cancelOnAbort, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { value, done } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > FORM_LIMIT) {
        await reader.cancel();
        return tooLarge();
      }
      chunks.push(value);
    }
  } finally {
    signal.removeEventListener('abort', cancelOnAbort);
    reader.releaseLock();
  }
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

function tooLarge(): Response {
  return messagePage(413, 'The form data is too large.');
}
