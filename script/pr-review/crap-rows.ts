import { CommandError } from '../code-quality/shared/command-error.ts';
import { jsonFieldsInFile } from '../code-quality/shared/json-file.ts';
import { invalidKey, isRecord, type Values } from './rules-values.ts';

const changes = ['new', 'changed', 'unchanged', 'unknown'] as const;

// The check only validates crap and identity: it computes the goals again from paths and share.
export interface CrapRow {
  readonly file: string;
  readonly function: string;
  readonly change: (typeof changes)[number];
  readonly paths: number;
  readonly share?: number;
}

type Read = <T>(name: string, value: T | undefined, expected: string) => T;

// Rows of another commit describe another tree than the candidate, and rows of another base classify the functions
// as new or changed against another tree.
export function crapRowsOf(path: string, revisions: { readonly mergeBase: string; readonly head: string }): CrapRow[] {
  const where = `The CRAP file ${path}`;
  const fields = jsonFieldsInFile(path, 'CRAP');
  if (fields.version !== 1) throw invalidKey(where, 'version', 'give 1');
  if (typeof fields.base !== 'string') throw invalidKey(where, 'base', 'give a text');
  if (typeof fields.head !== 'string') throw invalidKey(where, 'head', 'give a text');
  if (fields.head !== revisions.head) throw new CommandError(`${where} is of commit ${fields.head}, but the candidate is ${revisions.head}. Run the CRAP command with --json again after the last commit.`);
  if (fields.base !== revisions.mergeBase) throw new CommandError(`${where} compares with ${fields.base}, but the merge base is ${revisions.mergeBase}. Run the CRAP command with the same --base as the check.`);
  if (!Array.isArray(fields.rows)) throw invalidKey(where, 'rows', 'give a list');
  return fields.rows.map((entry, index) => rowOf(isRecord(entry) ? entry : {}, readerOf(where, `rows[${index}]`)));
}

function readerOf(where: string, key: string): Read {
  return (name, value, expected) => {
    if (value === undefined) throw invalidKey(where, `${key}.${name}`, expected);
    return value;
  };
}

function rowOf(fields: Values, read: Read): CrapRow {
  const row = {
    file: read('file', textOf(fields.file), 'give a non-empty text'),
    function: read('function', textOf(fields.function), 'give a non-empty text'),
    change: read('change', changes.find((change) => change === fields.change), 'give new, changed, unchanged, or unknown'),
    paths: read('paths', wholeOf(fields.paths), 'give a whole number, 0 or more'),
  };
  const share = fields.share === undefined ? undefined : read('share', shareOf(fields.share), 'give a number from 0 to 1, or leave it out');
  read('crap', fields.crap === undefined || finite(fields.crap) ? true : undefined, 'give a finite number, or leave it out');
  read('identity', fields.identity === undefined || typeof fields.identity === 'string' ? true : undefined, 'give a text, or leave it out');
  return share === undefined ? row : { ...row, share };
}

function textOf(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function wholeOf(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function shareOf(value: unknown): number | undefined {
  return finite(value) && value >= 0 && value <= 1 ? value : undefined;
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
