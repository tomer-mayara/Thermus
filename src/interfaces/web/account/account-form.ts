import { timingSafeEqual } from 'node:crypto';
import type {
  InvitationChangeRequest,
  InvitationSendRequest,
} from '../../../accounts/organizations/organization-administration.ts';
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
// A provider ID, a revision, a role, or an action is visible ASCII text. The service decides which roles and actions
// it accepts.
const FIELD_VALUE = /^[\x21-\x7E]{1,256}$/;
// An address without a space or a control character, with one @ between two parts. The provider checks the rest.
const EMAIL = /^[^\s@\x00-\x1F\x7F]+@[^\s@\x00-\x1F\x7F]+$/;
const EMAIL_LIMIT = 254;

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

// The form has no other field, so that a selection cannot also change an organization or a grant.
export function selectionIn(form: URLSearchParams, csrfToken: string, destinations: ReturnDestinations): Selection | FormRefusal {
  const fields = formFields(form, csrfToken, ['organization_id', 'return_to']);
  if (typeof fields === 'string') return fields;
  const returnTo = destinations.check(fields.return_to);
  if (!FIELD_VALUE.test(fields.organization_id) || returnTo === undefined) return 'invalidRequest';
  return { organizationId: fields.organization_id, returnTo };
}

export function invitationIn(form: URLSearchParams, csrfToken: string): InvitationSendRequest | FormRefusal {
  const fields = formFields(form, csrfToken, ['organization_id', 'role', 'email']);
  if (typeof fields === 'string') return fields;
  const valid = FIELD_VALUE.test(fields.organization_id) && FIELD_VALUE.test(fields.role) && fields.email.length <= EMAIL_LIMIT && EMAIL.test(fields.email);
  return valid ? { organizationId: fields.organization_id, role: fields.role, email: fields.email } : 'invalidRequest';
}

export function invitationChangeIn(form: URLSearchParams, csrfToken: string): InvitationChangeRequest | FormRefusal {
  const fields = formFields(form, csrfToken, ['organization_id', 'invitation_id']);
  if (typeof fields === 'string') return fields;
  if (!FIELD_VALUE.test(fields.organization_id) || !FIELD_VALUE.test(fields.invitation_id)) return 'invalidRequest';
  return { organizationId: fields.organization_id, invitationId: fields.invitation_id };
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

// The values of a form that has the form token of the session and exactly these other fields, each one time. The token
// comes first, so that a forged post learns nothing about its other fields.
export function formFields<Name extends string>(form: URLSearchParams, csrfToken: string, names: readonly Name[]): Record<Name, string> | FormRefusal {
  if (!isSessionToken(single(form.getAll('csrf_token')), csrfToken)) return 'forgedRequest';
  const allowed: ReadonlySet<string> = new Set(['csrf_token', ...names]);
  if ([...form.keys()].some((name) => !allowed.has(name))) return 'invalidRequest';
  const values = names.map((name) => [name, single(form.getAll(name))] as const);
  if (values.some(([, value]) => value === undefined)) return 'invalidRequest';
  return Object.fromEntries(values) as Record<Name, string>;
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
