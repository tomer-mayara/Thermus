import type { NoticeName } from './workos-session-pages.ts';

type SignOutForm = { readonly csrfToken: string } | { readonly refusal: Extract<NoticeName, 'formTypeRefused' | 'formTooLarge' | 'invalidRequest'> };

const FORM_LIMIT = 16 * 1024;

// The sign-out form has exactly one CSRF token and no other field, so that a post cannot carry other input.
export async function readSignOutForm(request: Request): Promise<SignOutForm> {
  const contentType = request.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase();
  if (contentType !== 'application/x-www-form-urlencoded') return { refusal: 'formTypeRefused' };
  const form = await readBody(request);
  if (form === undefined) return { refusal: 'formTooLarge' };
  const tokens = form.getAll('csrf_token');
  const onlyToken = tokens.length === 1 && [...form.keys()].every((name) => name === 'csrf_token');
  return onlyToken ? { csrfToken: tokens[0] ?? '' } : { refusal: 'invalidRequest' };
}

// Undefined for a body over 16 KiB. The reading stops at the limit, so that a large body causes no more work.
async function readBody(request: Request): Promise<URLSearchParams | undefined> {
  const length = request.headers.get('Content-Length');
  if (length !== null && Number(length) > FORM_LIMIT) {
    await request.body?.cancel();
    return undefined;
  }
  if (request.body === null) return new URLSearchParams();
  return readChunks(request.body, request.signal);
}

// A client that disconnects cancels the reading.
async function readChunks(body: ReadableStream<Uint8Array>, signal: AbortSignal): Promise<URLSearchParams | undefined> {
  const reader = body.getReader();
  const cancelOnAbort = () => { void reader.cancel(signal.reason).catch(() => undefined); };
  signal.addEventListener('abort', cancelOnAbort, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      signal.throwIfAborted();
      size += chunk.value.byteLength;
      if (size > FORM_LIMIT) {
        await reader.cancel();
        return undefined;
      }
      chunks.push(chunk.value);
    }
    signal.throwIfAborted();
  } finally {
    signal.removeEventListener('abort', cancelOnAbort);
    reader.releaseLock();
  }
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}
