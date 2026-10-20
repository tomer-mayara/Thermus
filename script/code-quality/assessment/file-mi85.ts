import { snapshotObservationsIn } from '../snapshot/observations.ts';
import { CommandError } from '../shared/command-error.ts';

interface FileMi85 {
  readonly path: string;
  readonly state: 'MEETS' | 'LOW' | 'UNKNOWN';
  readonly maintainabilityRaw?: number;
  readonly reason: string;
}

type Binding = Parameters<typeof snapshotObservationsIn>[1];
type FileObservation = ReturnType<typeof snapshotObservationsIn>['files'][number];

// The caller supplies the affected paths. This calculation does not prove scope,
// provenance, class identity, review routes, or merge eligibility.
export function fileMi85Of(text: string, expected: Binding, selected: readonly string[]): readonly FileMi85[] {
  const snapshot = snapshotObservationsIn(text, expected);
  const paths = selectedPathsIn(selected);
  const files = new Map(snapshot.files.map((file) => [file.path, file]));
  return paths.map((path) => resultOf(path, files.get(path)));
}

function resultOf(path: string, file: FileObservation | undefined): FileMi85 {
  if (file === undefined) return { path, state: 'UNKNOWN', reason: 'The snapshot has no row for this file.' };
  const raw = file.maintainabilityRaw;
  if (raw === undefined) return { path, state: 'UNKNOWN', reason: 'The snapshot row has no raw file MI.' };
  return raw >= 85
    ? { path, state: 'MEETS', maintainabilityRaw: raw, reason: 'Raw file MI is at least 85.' }
    : { path, state: 'LOW', maintainabilityRaw: raw, reason: 'Raw file MI is below 85.' };
}

function selectedPathsIn(value: readonly string[]): readonly string[] {
  if (!Array.isArray(value)) invalid('selected', 'an array');
  const seen = new Set<string>();
  for (const [index, path] of value.entries()) {
    if (!canonicalSourcePath(path)) invalid(`selected[${index}]`, 'a canonical src/ path');
    if (seen.has(path)) invalid(`selected[${index}]`, 'a unique source path');
    seen.add(path);
  }
  return value;
}

function canonicalSourcePath(value: unknown): value is string {
  if (typeof value !== 'string' || !value.startsWith('src/') || /[\\\u0000-\u001f\u007f-\u009f]/u.test(value)) return false;
  return value.split('/').every((part) => part !== '' && part !== '.' && part !== '..');
}

function invalid(field: string, expected: string): never {
  throw new CommandError(`Invalid file MI85 selection at ${field}: expected ${expected}.`);
}
