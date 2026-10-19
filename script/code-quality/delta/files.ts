// The delta rule of script/code-quality/ast-metrics-delta.ts. A module of its own, because the architecture command gives the same
// files as the changed files of a pull request.
import { git } from '../shared/repository.ts';
import { validateChanges, type FileChange } from './changes.ts';
import { changesInDiff } from './status.ts';

const typeScriptFiles = ['*.ts', '*.tsx', '*.mts', '*.cts'];

// Deleted files have no current score. Renamed files use their new path.
export function deltaFiles(root: string, base: string): string[] {
  return deltaChanges(root, base).filter((change) => change.status !== 'D').map((change) => change.path).sort();
}

export function deltaChanges(root: string, base: string): FileChange[] {
  const changed = git(root, ['diff', '--name-status', '-z', '-M', '--merge-base', base, '--', ...typeScriptFiles], `git diff against ${base} failed.`);
  const untracked = git(root, ['ls-files', '-z', '--others', '--exclude-standard', '--', ...typeScriptFiles], 'git ls-files failed.');
  const additions: FileChange[] = untracked.split('\0').filter((path) => path !== '').map((path) => ({ status: 'A', path }));
  return validateChanges([...changesInDiff(changed), ...additions]).sort((first, second) => first.path < second.path ? -1 : first.path > second.path ? 1 : 0);
}
