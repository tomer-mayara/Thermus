import { sign, verify, type KeyObject } from 'node:crypto';

export const ORGANIZATION_ID = 'org_probe_a';
const SUBJECT = 'user_probe';
const CONTEXT_LIFETIME_MS = 120_000;

export interface AccessContext { readonly organizationId: string; readonly subject: string; readonly expiresAt: number }
export type Refusal = 'missing' | 'malformed' | 'bad_signature' | 'expired';
type AccessDecision = { readonly context: AccessContext } | { readonly reason: Refusal };

export function probeContext(expiresAt = Date.now() + CONTEXT_LIFETIME_MS): AccessContext {
  return { organizationId: ORGANIZATION_ID, subject: SUBJECT, expiresAt };
}

export function signAccess(context: AccessContext, privateKey: KeyObject): string {
  const body = Buffer.from(JSON.stringify(context));
  return `${body.toString('base64url')}.${sign(null, body, privateKey).toString('base64url')}`;
}

export function verifyAccess(header: string | undefined, publicKey: KeyObject): AccessDecision {
  if (header === undefined) return { reason: 'missing' };
  const [encodedBody, encodedSignature, ...rest] = header.split('.');
  if (rest.length > 0 || !isBase64Url(encodedBody) || !isBase64Url(encodedSignature)) return { reason: 'malformed' };
  const body = Buffer.from(encodedBody, 'base64url');
  if (!signatureMatches(body, Buffer.from(encodedSignature, 'base64url'), publicKey)) return { reason: 'bad_signature' };
  const context = contextOf(body);
  if (context === undefined) return { reason: 'malformed' };
  return context.expiresAt > Date.now() ? { context } : { reason: 'expired' };
}

function isBase64Url(value: string | undefined): value is string {
  return value !== undefined && /^[A-Za-z0-9_-]+$/.test(value);
}

function signatureMatches(body: Buffer, signature: Buffer, publicKey: KeyObject): boolean {
  try {
    return verify(null, body, publicKey, signature);
  } catch {
    return false;
  }
}

function contextOf(body: Buffer): AccessContext | undefined {
  let value: unknown;
  try {
    value = JSON.parse(body.toString('utf8'));
  } catch {
    return undefined;
  }
  const { organizationId, subject, expiresAt } = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  if (typeof organizationId !== 'string' || typeof subject !== 'string' || typeof expiresAt !== 'number') return undefined;
  return { organizationId, subject, expiresAt };
}
