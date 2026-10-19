import { git } from '../shared/repository.ts';
import type { MapSources } from './types.ts';

// This selection includes inputs that the TypeScript complexity delta cannot see.
export function testChangesOnlyInRepository(root: string, base: string): boolean {
  const changed = git(root, ['diff', '--name-only', '-z', '--no-renames', '--merge-base', base, '--'], `git diff against ${base} failed.`);
  const untracked = git(root, ['ls-files', '-z', '--others', '--exclude-standard'], 'git ls-files failed.');
  return testChangesOnlyInPaths([...changed.split('\0'), ...untracked.split('\0')]);
}

export function testChangesOnlyInPaths(paths: readonly string[]): boolean {
  return paths.some((path) => path.startsWith('test/')) && !paths.some((path) => path.startsWith('src/'));
}

export function testChangeNoticeOf({ testChangesOnly }: Pick<MapSources, 'testChangesOnly'>, covered: boolean): string[] {
  if (!testChangesOnly) return [];
  return ['', covered
    ? 'Test changes are not judged: the base uses the coverage of the head.'
    : 'Test changes are not judged: no coverage comparison was made.'];
}
