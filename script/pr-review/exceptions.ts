import { documentOf, invalidKey, isRecord, valueAt, type Values } from './rules-values.ts';
import type { Reason } from './types.ts';

export const exceptionsPath = '.code-quality-exceptions.yaml';
const where = `The exceptions file ${exceptionsPath} at HEAD`;
const date = /^\d{4}-\d{2}-\d{2}$/u;

// The dates are YYYY-MM-DD, so text order is time order.
export interface MiException {
  readonly path: string;
  readonly bound: number;
  readonly reason: string;
  readonly expires: string;
}

interface CoveredFile {
  readonly path: string;
  readonly raw: number;
  readonly today: string;
}

export function exceptionsOf(text: string | undefined): MiException[] {
  if (text === undefined) return [];
  const entries = valueAt(documentOf(text, where), 'exceptions');
  if (!Array.isArray(entries)) throw invalidKey(where, 'exceptions', 'give a list of entries');
  return entries.map((entry, index) => entryOf(isRecord(entry) ? entry : {}, `exceptions[${index}]`));
}

export function coveringException(entries: readonly MiException[], file: CoveredFile): MiException | undefined {
  return entries.find((entry) => entry.path === file.path && file.raw >= entry.bound && file.today <= entry.expires);
}

export function expiredReasons(entries: readonly MiException[], changed: readonly string[], today: string): Reason[] {
  const paths = entries.filter((entry) => entry.expires < today && changed.includes(entry.path)).map((entry) => entry.path);
  return [...new Set(paths)].map((path) => ({ route: 'FIX', key: 'ratchet.exceptions.expired', fact: path }));
}

function entryOf(fields: Values, key: string): MiException {
  const checked = <T>(name: string, value: T | undefined, expected: string): T => {
    if (value === undefined) throw invalidKey(where, `${key}.${name}`, expected);
    return value;
  };
  const path = checked('path', textOf(fields.path), 'give a non-empty text');
  checked('metric', fields.metric === 'mi' ? fields.metric : undefined, 'give mi');
  return {
    path,
    bound: checked('bound', typeof fields.bound === 'number' && Number.isFinite(fields.bound) ? fields.bound : undefined, 'give a finite number'),
    reason: checked('reason', textOf(fields.reason), 'give a non-empty text'),
    expires: checked('expires', dateOf(fields.expires), 'give a date as YYYY-MM-DD'),
  };
}

function textOf(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

// Date.parse rolls 2025-02-29 over to March 1, so the date must survive the round trip.
function dateOf(value: unknown): string | undefined {
  if (typeof value !== 'string' || !date.test(value)) return undefined;
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().startsWith(value) ? value : undefined;
}
