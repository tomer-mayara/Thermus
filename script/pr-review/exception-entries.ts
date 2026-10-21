import { invalidKey, type Values } from './rules-values.ts';

const date = /^\d{4}-\d{2}-\d{2}$/u;
const functionForm = /^[^#]+#.+$/u;

// The dates are YYYY-MM-DD, so text order is time order.
interface Terms {
  readonly bound: number;
  readonly reason: string;
  readonly expires: string;
}

export interface MiException extends Terms {
  readonly path: string;
}

export interface CrapException extends Terms {
  readonly function: string;
}

export type CodeQualityException = MiException | CrapException;
type Read = <T>(name: string, value: T | undefined, expected: string) => T;

// An entry of metric mi names a file, and an entry of metric crap names a function, so that one bound applies to one unit.
export function entryOf(fields: Values, key: string, where: string): CodeQualityException {
  const read: Read = (name, value, expected) => {
    if (value === undefined) throw invalidKey(where, `${key}.${name}`, expected);
    return value;
  };
  if (fields.function === undefined) return { path: read('path', textOf(fields.path), 'give a non-empty text'), ...termsOf(fields, read, 'mi') };
  if (fields.path !== undefined) throw invalidKey(where, key, 'give path or function, not both');
  const name = typeof fields.function === 'string' && functionForm.test(fields.function) ? fields.function : undefined;
  return { function: read('function', name, 'give a text of the form <file>#<function>'), ...termsOf(fields, read, 'crap') };
}

function termsOf(fields: Values, read: Read, metric: 'mi' | 'crap'): Terms {
  read('metric', fields.metric === metric ? metric : undefined, `give ${metric}`);
  return {
    bound: read('bound', typeof fields.bound === 'number' && Number.isFinite(fields.bound) ? fields.bound : undefined, 'give a finite number'),
    reason: read('reason', textOf(fields.reason), 'give a non-empty text'),
    expires: read('expires', dateOf(fields.expires), 'give a date as YYYY-MM-DD'),
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
