import { createCipheriv, createDecipheriv, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';

// The facts of a browser session that the sealed session of WorkOS does not keep across a refresh.
export interface SessionEnvelope {
  // The sealed session of WorkOS.
  readonly seal: string;
  // It stays the same for the whole session, also after a refresh or an organization switch.
  readonly csrf: string;
  // Legacy wire field. The current adapter discards old true values and always writes false.
  readonly mfa: boolean;
}

export interface SignInEnvelope {
  readonly state: string;
  readonly codeVerifier: string;
  readonly returnTo: string;
  // Milliseconds since the Unix epoch.
  readonly expiresAt: number;
}

interface CookieKind<Content> {
  readonly name: string;
  // The additional data of each seal, so that the value of one cookie never opens as the other.
  readonly purpose: string;
  readonly maxAgeSeconds: number;
  readonly isContent: (value: unknown) => value is Content;
}

export const SIGN_IN_MAX_AGE_SECONDS = 600;
// WorkOS decides when a session ends. Each refresh sends the cookie again, so the browser drops it only after a long pause.
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const VERSION = 'v1.';
const KEY_INFO = 'thermus browser cookie envelope v1';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const BASE64URL = /^[A-Za-z0-9_-]+$/;

// A cookie that holds sealed content: AES-256-GCM with a key from the cookie password and a random IV for each seal.
// The browser can keep the value, but it cannot read or change the content.
export class SealedCookie<Content> {
  readonly name: string;
  private readonly kind: CookieKind<Content>;
  private readonly key: Buffer;

  constructor(cookiePassword: string, kind: CookieKind<Content>) {
    this.name = kind.name;
    this.kind = kind;
    this.key = Buffer.from(hkdfSync('sha256', cookiePassword, '', KEY_INFO, 32));
  }

  setCookie(content: Content): string {
    return setCookieValue(this.name, seal(this.key, this.kind.purpose, content), this.kind.maxAgeSeconds);
  }

  clearCookie(): string {
    return setCookieValue(this.name, '', 0);
  }

  // True when the Cookie header has a cookie of this name, also one that does not open.
  isSentIn(cookieHeader: string | null): boolean {
    return cookieValues(cookieHeader, this.name).length > 0;
  }

  // The content of the one cookie of this name. A client controls its cookies, so no cookie, two cookies, and each
  // fault of the value give undefined instead of an error.
  contentOf(cookieHeader: string | null): Content | undefined {
    const values = cookieValues(cookieHeader, this.name);
    const content = values.length === 1 ? open(this.key, this.kind.purpose, values[0] ?? '') : undefined;
    return this.kind.isContent(content) ? content : undefined;
  }
}

export function sessionCookie(cookiePassword: string): SealedCookie<SessionEnvelope> {
  return new SealedCookie(cookiePassword, {
    name: '__Host-thermus-session',
    purpose: 'session',
    maxAgeSeconds: SESSION_MAX_AGE_SECONDS,
    isContent: isSessionEnvelope,
  });
}

export function signInCookie(cookiePassword: string): SealedCookie<SignInEnvelope> {
  return new SealedCookie(cookiePassword, {
    name: '__Host-thermus-sign-in',
    purpose: 'sign-in',
    maxAgeSeconds: SIGN_IN_MAX_AGE_SECONDS,
    isContent: isSignInEnvelope,
  });
}

// Compares two secrets in constant time. An empty secret is never equal.
export function sameSecret(sent: string, secret: string): boolean {
  const sentBytes = Buffer.from(sent);
  const secretBytes = Buffer.from(secret);
  return secretBytes.length > 0 && sentBytes.length === secretBytes.length && timingSafeEqual(sentBytes, secretBytes);
}

// SameSite=Lax, because the AuthKit callback is a top-level navigation from another site. The __Host- prefix makes the
// browser refuse the cookie without Secure and Path=/, or with a Domain.
function setCookieValue(name: string, value: string, maxAgeSeconds: number): string {
  return `${name}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
}

function cookieValues(cookieHeader: string | null, name: string): string[] {
  if (cookieHeader === null) return [];
  return cookieHeader.split(';').flatMap((pair) => {
    const separator = pair.indexOf('=');
    return separator !== -1 && pair.slice(0, separator).trim() === name ? [pair.slice(separator + 1).trim()] : [];
  });
}

function seal(key: Buffer, purpose: string, content: unknown): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(purpose));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(content), 'utf8'), cipher.final()]);
  return `${VERSION}${Buffer.concat([iv, encrypted, cipher.getAuthTag()]).toString('base64url')}`;
}

// Only the canonical base64url text of the bytes opens, so that no other text gives the same value.
function open(key: Buffer, purpose: string, value: string): unknown {
  const text = value.startsWith(VERSION) ? value.slice(VERSION.length) : '';
  if (!BASE64URL.test(text)) return undefined;
  const bytes = Buffer.from(text, 'base64url');
  if (bytes.toString('base64url') !== text || bytes.length <= IV_BYTES + TAG_BYTES) return undefined;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, IV_BYTES), { authTagLength: TAG_BYTES });
    decipher.setAAD(Buffer.from(purpose));
    decipher.setAuthTag(bytes.subarray(bytes.length - TAG_BYTES));
    const plain = Buffer.concat([decipher.update(bytes.subarray(IV_BYTES, bytes.length - TAG_BYTES)), decipher.final()]);
    return JSON.parse(plain.toString('utf8'));
  } catch {
    return undefined;
  }
}

function isSessionEnvelope(value: unknown): value is SessionEnvelope {
  return hasExactly(value, ['seal', 'csrf', 'mfa']) && isText(value.seal) && isText(value.csrf) && typeof value.mfa === 'boolean';
}

function isSignInEnvelope(value: unknown): value is SignInEnvelope {
  return hasExactly(value, ['state', 'codeVerifier', 'returnTo', 'expiresAt'])
    && isText(value.state) && isText(value.codeVerifier) && isText(value.returnTo) && Number.isFinite(value.expiresAt);
}

function hasExactly<Key extends string>(value: unknown, keys: readonly Key[]): value is Record<Key, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => actual.includes(key));
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}
