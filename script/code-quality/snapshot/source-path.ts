import { lstatSync } from 'node:fs';
import { join } from 'node:path';
import { canonicalSourcePath } from '../dependencies/resolve.ts';

export function sourcePathOf(root: string, path: string): string {
  if (!canonicalSourcePath(path)) throw new Error('Invalid source path.');
  let current = root;
  for (const part of path.split('/')) {
    current = join(current, part);
    if (lstatSync(current).isSymbolicLink()) throw new Error('Source evidence cannot follow symbolic links.');
  }
  return current;
}
