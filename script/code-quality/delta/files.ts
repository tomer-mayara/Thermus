// The delta rule of script/code-quality/ast-metrics-delta.ts. A module of its own, because the architecture command gives the same
// files as the changed files of a pull request.
import { git } from '../shared/repository.ts';

const typeScriptFiles = ['*.ts', '*.tsx', '*.mts', '*.cts'];

// Each TypeScript file that differs between the merge base of the base ref and HEAD and the working tree, and each new
// file that git does not ignore, sorted. Without rename detection, git lists a renamed file as an added file, so the
// delta holds it at its new path.
export function deltaFiles(root: string, base: string): string[] {
  const changed = git(root, ['diff', '--name-only', '-z', '--no-renames', '--diff-filter=AM', '--merge-base', base, '--', ...typeScriptFiles], `git diff against ${base} failed.`);
  const untracked = git(root, ['ls-files', '-z', '--others', '--exclude-standard', '--', ...typeScriptFiles], 'git ls-files failed.');
  return [...new Set(`${changed}${untracked}`.split('\0').filter((file) => file !== ''))].sort();
}
