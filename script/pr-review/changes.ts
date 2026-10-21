import { CommandError } from '../code-quality/shared/command-error.ts';
import type { Change } from './types.ts';

export interface NumstatRow {
  readonly added: number;
  readonly deleted: number;
  readonly paths: readonly string[];
}

// In git diff --name-status -z, a rename or a copy has a score after its letter and two paths.
export function changesOf(output: string): Change[] {
  const fields = output.split('\0');
  const changes: Change[] = [];
  for (let index = 0; fields[index]; ) {
    const status = fields[index].charAt(0);
    const pair = status === 'R' || status === 'C';
    changes.push(pair ? { status, oldPath: fields[index + 1], path: fields[index + 2] } : { status, path: fields[index + 1] });
    index += pair ? 3 : 2;
  }
  return changes;
}

export function changedPathsOf(changes: readonly Change[]): string[] {
  return [...new Set(changes.flatMap((change) => (change.oldPath === undefined ? [change.path] : [change.oldPath, change.path])))];
}

// In git diff --numstat -z, a binary file has "-" for its counts, and a rename has an empty path and then two paths.
export function numstatOf(output: string): NumstatRow[] {
  const fields = output.split('\0');
  const rows: NumstatRow[] = [];
  for (let index = 0; fields[index]; ) {
    const match = /^(\d+|-)\t(\d+|-)\t(.*)$/su.exec(fields[index]);
    if (!match) throw new CommandError(`git diff --numstat gave a line that the check cannot read: ${fields[index]}`);
    const [, added, deleted, path] = match;
    rows.push({ added: countOf(added), deleted: countOf(deleted), paths: path === '' ? [fields[index + 1], fields[index + 2]] : [path] });
    index += path === '' ? 3 : 1;
  }
  return rows;
}

function countOf(field: string): number {
  return field === '-' ? 0 : Number(field);
}
