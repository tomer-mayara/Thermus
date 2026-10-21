import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { componentDefinitionsOf, componentOwnersOf } from '../../component-ownership.ts';
import { CommandError, git } from '../shared/repository.ts';

// Read this tree's policy with the caller's installed parser. Baseline worktrees
// still need no dependencies and execute no code from the measured revision.
export function ownershipOfTree(root: string) {
  const path = join(root, 'docs/implementation/pr-review-rules.yaml');
  if (!existsSync(path)) return undefined;
  let document;
  try { document = parse(readFileSync(path, 'utf8')); }
  catch { throw new CommandError(`Cannot read component ownership from ${path}.`); }
  const definitions = componentDefinitionsOf(document?.dependency_graph?.components, path);
  if (definitions !== undefined) {
    const paths = git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'src'], 'Cannot list component source files.')
      .split('\0').filter((file) => file !== '' && existsSync(join(root, file)));
    componentOwnersOf([...new Set(paths)], definitions);
  }
  return definitions;
}
