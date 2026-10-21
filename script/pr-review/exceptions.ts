import { entryOf, type CodeQualityException, type CrapException, type MiException } from './exception-entries.ts';
import { documentOf, invalidKey, isRecord, valueAt } from './rules-values.ts';
import type { Reason } from './types.ts';

export type { CodeQualityException } from './exception-entries.ts';

export const exceptionsPath = '.code-quality-exceptions.yaml';
const where = `The exceptions file ${exceptionsPath} at HEAD`;

interface CoveredFile {
  readonly path: string;
  readonly raw: number;
  readonly today: string;
}

interface CoveredFunction {
  readonly function: string;
  readonly today: string;
  readonly within: (bound: number) => boolean;
}

export function exceptionsOf(text: string | undefined): CodeQualityException[] {
  if (text === undefined) return [];
  const entries = valueAt(documentOf(text, where), 'exceptions');
  if (!Array.isArray(entries)) throw invalidKey(where, 'exceptions', 'give a list of entries');
  return entries.map((entry, index) => entryOf(isRecord(entry) ? entry : {}, `exceptions[${index}]`, where));
}

export function coveringException(entries: readonly CodeQualityException[], file: CoveredFile): MiException | undefined {
  return entries.filter(isMi).find((entry) => entry.path === file.path && file.raw >= entry.bound && file.today <= entry.expires);
}

export function coveringCrapException(entries: readonly CodeQualityException[], covered: CoveredFunction): CrapException | undefined {
  return entries.filter(isCrap).find((entry) => entry.function === covered.function && covered.today <= entry.expires && covered.within(entry.bound));
}

// The unit of a function entry changes with the file of its function.
export function expiredReasons(entries: readonly CodeQualityException[], changed: readonly string[], today: string): Reason[] {
  const units = entries.filter((entry) => entry.expires < today && changed.includes(fileOf(entry))).map(unitOf);
  return [...new Set(units)].map((unit) => ({ route: 'FIX', key: 'ratchet.exceptions.expired', fact: unit }));
}

function isMi(entry: CodeQualityException): entry is MiException {
  return 'path' in entry;
}

function isCrap(entry: CodeQualityException): entry is CrapException {
  return !isMi(entry);
}

function unitOf(entry: CodeQualityException): string {
  return isMi(entry) ? entry.path : entry.function;
}

function fileOf(entry: CodeQualityException): string {
  return isMi(entry) ? entry.path : entry.function.slice(0, entry.function.indexOf('#'));
}
