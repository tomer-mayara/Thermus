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

export interface FileComparison {
  readonly path: string;
  readonly basePath: string;
  readonly label: string;
}

export function changedFilesOf(touched: readonly string[], changes: readonly FileChange[] | undefined): FileComparison[] {
  const { before, after } = fileMappingOf(changes);
  const paths = [...new Set(touched.map((path) => after.get(path) ?? path).filter((path) => path.startsWith('src/')))].sort();
  return paths.map((path) => {
    const oldPath = before.get(path);
    return { path, basePath: oldPath ?? path, label: oldPath === undefined ? path : `${path} (renamed from ${oldPath})` };
  });
}
