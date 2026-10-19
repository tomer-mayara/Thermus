import { supportedPath, type FileChange } from '../delta/changes.ts';
import { objectOf } from '../shared/json.ts';
import { CommandError } from '../shared/repository.ts';

const statuses = new Map<unknown, FileChange['status']>([['A', 'A'], ['M', 'M'], ['D', 'D'], ['R', 'R']]);

export function changeOf(value: unknown, file: string): FileChange {
  const fields = objectOf(value);
  const { path, oldPath } = fields;
  const status = statuses.get(fields.status);
  if (status === undefined) invalid(file);
  if (!sourcePath(path)) invalid(file);
  if (status === 'R') {
    if (!sourcePath(oldPath) || oldPath === path) invalid(file);
    return { status, path, oldPath };
  }
  if (oldPath !== undefined) invalid(file);
  return { status, path };
}

function invalid(file: string): never {
  throw new CommandError(`The file ${file} contains an invalid file change.`);
}

function sourcePath(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('src/') && supportedPath(value);
}

export function checkSides(change: FileChange, before: ReadonlySet<string>, after: ReadonlySet<string>): void {
  const oldPath = change.oldPath ?? change.path;
  const valid = change.status === 'R'
    ? before.has(oldPath) && !after.has(oldPath) && !before.has(change.path) && after.has(change.path)
    : before.has(change.path) === (change.status !== 'A') && after.has(change.path) === (change.status !== 'D');
  if (!valid) throw new CommandError(`The ${change.status} change for ${change.path} conflicts with the snapshot files.`);
}
