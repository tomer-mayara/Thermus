import { CommandError } from '../shared/repository.ts';
import type { FileChange } from '../delta/changes.ts';

// Only status evidence maps paths. A touched path alone gives no correspondence.
export function fileMappingOf(changes: readonly FileChange[] = []): { readonly before: ReadonlyMap<string, string>; readonly after: ReadonlyMap<string, string> } {
  const pairs = changes.flatMap(({ status, oldPath, path }) => {
    if (status !== 'R') return [];
    if (oldPath === undefined) throw new CommandError('A rename needs its old path.');
    return oldPath.startsWith('src/') && path.startsWith('src/') ? [[oldPath, path] as const] : [];
  });
  return { before: new Map(pairs.map(([before, after]) => [after, before])), after: new Map(pairs) };
}
