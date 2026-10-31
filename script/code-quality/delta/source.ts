import { CommandError } from '../shared/repository.ts';
import type { FileChange } from './changes.ts';

export function changeWithin(change: FileChange, includes: (path: string) => boolean): FileChange[] {
  if (change.status !== 'R') return includes(change.path) ? [change] : [];
  const oldPath = change.oldPath;
  if (oldPath === undefined) throw new CommandError('A rename change needs an old path.');
  const old = includes(oldPath);
  const head = includes(change.path);
  if (old && head) return [change];
  if (old) return [{ status: 'D', path: oldPath }];
  return head ? [{ status: 'A', path: change.path }] : [];
}

export function changesInSource(changes: readonly FileChange[]): FileChange[] {
  return changes.flatMap((change) => changeWithin(change, (path) => path.startsWith('src/')));
}
