import { timingSafeEqual } from 'node:crypto';
import type { NoticeName } from './account-pages.ts';

export type FormRefusal = Extract<NoticeName, 'formTypeRefused' | 'formTooLarge' | 'forgedRequest' | 'invalidRequest'>;

export interface Selection {
  readonly organizationId: string;
  readonly returnTo: string;
}

const FORM_LIMIT = 16 * 1024;
const DESTINATION_LIMIT = 1_024;
// Path characters of RFC 3986. A query, a fragment, a backslash, a space, and a control character are not path
// characters, and a second slash at the start would name another host.
const DESTINATION_PATH = /^\/(?!\/)[A-Za-z0-9\-._~!$&'()*+,;=:@%/]*$/;
// A provider ID is visible ASCII text.
const ORGANIZATION_ID = /^[\x21-\x7E]{1,256}$/;
const SELECTION_FIELDS: ReadonlySet<string> = new Set(['csrf_token', 'organization_id', 'return_to']);

// A return destination is a path under the public path, so that the redirect after a form goes only to a page of this
// service.
export class ReturnDestinations {
  readonly fallback: string;
  private readonly origin: string;
  private readonly basePath: string;

  constructor(publicBaseUrl: string, fallback: string) {
    const base = new URL(publicBaseUrl);
    this.origin = base.origin;
    this.basePath = base.pathname;
    this.fallback = fallback;
  }

  // Gives the destination, or undefined for a value that is not a path under the public path or that the URL parser
  // would change, such as a path with dot segments.
  check(value: string | undefined): string | undefined {
    if (value === undefined || value.length > DESTINATION_LIMIT || !DESTINATION_PATH.test(value) || !value.startsWith(this.basePath)) return undefined;
    return new URL(value, this.origin).pathname === value ? value : undefined;
  }

  urlOf(destination: string): string {
    return new URL(destination, this.origin).href;
  }
}

export function single(values: readonly string[]): string | undefined {
  return values.length === 1 ? values[0] : undefined;
}

// The form token comes first, so that a forged post learns nothing about its other fields. The form has no other
// field, so that a selection cannot also change an organization or a grant.
export function selectionIn(form: URLSearchParams, csrfToken: string, destinations: ReturnDestinations): Selection | FormRefusal {
  if (!isSessionToken(single(form.getAll('csrf_token')), csrfToken)) return 'forgedRequest';
  if ([...form.keys()].some((name) => !SELECTION_FIELDS.has(name))) return 'invalidRequest';
  const organizationId = single(form.getAll('organization_id'));
  const returnTo = destinations.check(single(form.getAll('return_to')));
  if (organizationId === undefined || !ORGANIZATION_ID.test(organizationId) || returnTo === undefined) return 'invalidRequest';
  return { organizationId, returnTo };
}

// Reads an HTML form body of at most 16 KiB and stops at the limit, so that a large body causes no more work.
export async function readForm(request: Request): Promise<URLSearchParams | FormRefusal> {
  const contentType = request.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase();
  if (contentType !== 'application/x-www-form-urlencoded') return 'formTypeRefused';
  const length = request.headers.get('Content-Length');
  if (length !== null && Number(length) > FORM_LIMIT) {
    await request.body?.cancel();
    return 'formTooLarge';
  }
  if (request.body === null) return new URLSearchParams();
  return readBody(request.body, request.signal);
}

function isSessionToken(sent: string | undefined, token: string): boolean {
  if (sent === undefined || token === '') return false;
  const sentBytes = Buffer.from(sent);
  const tokenBytes = Buffer.from(token);
  return sentBytes.length === tokenBytes.length && timingSafeEqual(sentBytes, tokenBytes);
}

async function readBody(body: ReadableStream<Uint8Array>, signal: AbortSignal): Promise<URLSearchParams | FormRefusal> {
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
        return 'formTooLarge';
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
