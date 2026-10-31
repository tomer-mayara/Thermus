import { parse } from 'yaml';
import { CommandError } from '../code-quality/shared/command-error.ts';
import { unsupportedGlob } from './globs.ts';

// Each reader names the key that is missing or wrong, so that the author can correct the rules file. where names the
// file and the commit, for example "The rules file x.yaml at HEAD".
export type Values = Readonly<Record<string, unknown>>;

// The diagnostic of the YAML parser keeps its first line, so that the check reports one line.
export function documentOf(text: string, where: string): unknown {
  try {
    return parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CommandError(`${where} is not valid YAML: ${message.split('\n')[0]}`);
  }
}

export function isRecord(value: unknown): value is Values {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isTextList(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item !== '');
}

export function valueAt(document: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((value, name) => (isRecord(value) ? value[name] : undefined), document);
}

export function invalidKey(where: string, key: string, expected: string): CommandError {
  return new CommandError(`${where} has no valid key ${key}: ${expected}.`);
}

export function textAt(document: unknown, key: string, where: string): string {
  const value = valueAt(document, key);
  if (typeof value !== 'string' || value.trim() === '') throw invalidKey(where, key, 'give a non-empty text');
  return value;
}

export function numberAt(document: unknown, key: string, where: string): number {
  const value = valueAt(document, key);
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw invalidKey(where, key, 'give a whole number, 0 or more');
  return value;
}

export function textListAt(document: unknown, key: string, where: string): readonly string[] {
  const value = valueAt(document, key);
  if (!isTextList(value)) throw invalidKey(where, key, 'give a list of text');
  return value;
}

export function globListAt(document: unknown, key: string, where: string): readonly string[] {
  return checkedGlobs(textListAt(document, key, where), key, where);
}

export function globsAt(document: unknown, key: string, where: string): readonly string[] {
  const value = valueAt(document, key);
  const patterns = typeof value === 'string' ? [value] : value;
  if (!isTextList(patterns)) throw invalidKey(where, key, 'give a text or a list of text');
  return checkedGlobs(patterns, key, where);
}

function checkedGlobs(patterns: readonly string[], key: string, where: string): readonly string[] {
  const pattern = patterns.find(unsupportedGlob);
  if (pattern !== undefined) throw invalidKey(where, key, `give repository paths with only **, * and ? as wildcards, not ${pattern}`);
  return patterns;
}

export function recordAt(document: unknown, key: string, where: string): Values {
  const value = valueAt(document, key);
  if (!isRecord(value)) throw invalidKey(where, key, 'give a map');
  return value;
}

export function listAt(document: unknown, key: string, where: string): readonly unknown[] {
  const value = valueAt(document, key);
  if (!Array.isArray(value)) throw invalidKey(where, key, 'give a list');
  return value;
}

export function listsAt(document: unknown, key: string, where: string): ReadonlyMap<string, readonly string[]> {
  return new Map(Object.keys(recordAt(document, key, where)).map((name) => [name, textListAt(document, `${key}.${name}`, where)] as const));
}
