import { createHash } from 'node:crypto';
import type { SignupDocuments } from './workos-signup.ts';

const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const DOCUMENT_BYTES = 128 * 1024;

// Hash the exact bytes, including line endings. No trimming or Unicode normalization is permitted.
export function validateSignupDocuments(input: SignupDocuments): SignupDocuments {
  if (!validVersion(input.version)) throw new Error('The signup bundle version is not valid.');
  const terms = checkedDocument(input.terms);
  const notice = checkedDocument(input.notice);
  if (!validVersion(input.agreement.version) || !validText(input.agreement.text, 4096)) throw new Error('The signup agreement is not valid.');
  return Object.freeze({ version: input.version, terms, notice, agreement: Object.freeze({ ...input.agreement }) });
}

function checkedDocument(document: SignupDocuments['terms']): SignupDocuments['terms'] {
  if (!validVersion(document.version) || !validText(document.text, DOCUMENT_BYTES)
    || !/^[a-f0-9]{64}$/.test(document.sha256)
    || createHash('sha256').update(document.text, 'utf8').digest('hex') !== document.sha256) {
    throw new Error('The signup document bytes or hash are not valid.');
  }
  return Object.freeze({ ...document });
}

function validVersion(value: string): boolean {
  return typeof value === 'string' && VERSION.test(value);
}

function validText(value: string, limit: number): boolean {
  return typeof value === 'string' && value.trim() !== '' && Buffer.byteLength(value, 'utf8') <= limit
    && value.isWellFormed() && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
}
