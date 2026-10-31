import { CommandError } from '../code-quality/shared/command-error.ts';
import { jsonFieldsInFile } from '../code-quality/shared/json-file.ts';
import { invalidKey, isRecord, type Values } from './rules-values.ts';

type RawMiByPath = ReadonlyMap<string, number | undefined>;

export interface SnapshotPair {
  readonly base: RawMiByPath;
  readonly head: RawMiByPath;
  readonly notApplicable?: { readonly base: ReadonlySet<string>; readonly head: ReadonlySet<string> };
}

export interface SnapshotPaths {
  readonly base: string;
  readonly head: string;
}

const roles = {
  base: { commit: 'the merge base', retake: 'Take the snapshot again with the same --base as the check.' },
  head: { commit: 'the candidate', retake: 'Take the snapshot again after the last commit.' },
} as const;

export function snapshotPairOf(paths: SnapshotPaths, revisions: { readonly mergeBase: string; readonly head: string }): SnapshotPair {
  const base = rawMiOf('base', paths.base, revisions.mergeBase);
  const head = rawMiOf('head', paths.head, revisions.head);
  return { base: base.values, head: head.values, notApplicable: { base: base.notApplicable, head: head.notApplicable } };
}

// A snapshot of another commit would compare other trees than the candidate and its merge base.
function rawMiOf(name: keyof typeof roles, path: string, commit: string): { values: RawMiByPath; notApplicable: ReadonlySet<string> } {
  const where = `The ${name} snapshot ${path}`;
  const fields = jsonFieldsInFile(path, `${name} snapshot`);
  if (fields.version !== 1) throw invalidKey(where, 'version', 'give 1');
  if (typeof fields.commit !== 'string') throw invalidKey(where, 'commit', 'give a text');
  if (fields.commit !== commit) throw new CommandError(`${where} is of commit ${fields.commit}, but ${roles[name].commit} is ${commit}. ${roles[name].retake}`);
  if (!Array.isArray(fields.files)) throw invalidKey(where, 'files', 'give a list');
  const values = new Map(fields.files.map((entry, index) => fileOf(entry, `files[${index}]`, where)));
  const notApplicable = new Set(fields.files.filter((entry) => isRecord(entry) && entry.maintainabilityRaw === undefined && entry.paths === 0 && Array.isArray(entry.functions) && entry.functions.length === 0 && isRecord(entry.sourceEvidence) && entry.sourceEvidence.complete === true).map((entry) => entry.path as string));
  return { values, notApplicable };
}

function fileOf(entry: unknown, key: string, where: string): readonly [string, number | undefined] {
  const { path, maintainabilityRaw: raw }: Values = isRecord(entry) ? entry : {};
  if (typeof path !== 'string' || path === '') throw invalidKey(where, `${key}.path`, 'give a text');
  if (raw === undefined) return [path, undefined];
  if (typeof raw !== 'number' || !Number.isFinite(raw)) throw invalidKey(where, `${key}.maintainabilityRaw`, 'give a finite number');
  return [path, raw];
}
