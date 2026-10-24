import { git } from '../code-quality/shared/repository.ts';
import { blobsAt } from './blobs.ts';
import { snapshotPathOf } from './declaration-emit.ts';

export interface SnapshotTree {
  readonly commit: string;
  readonly folder: string;
}

export interface SnapshotTrees {
  readonly base: SnapshotTree;
  readonly head: SnapshotTree;
}

const diffOptions = ['--no-color', '--no-ext-diff', '--no-textconv'];

export function committedFiles(root: string, tree: SnapshotTree): string[] {
  const listing = git(root, ['ls-tree', '-r', '-z', '--name-only', tree.commit, '--', tree.folder], `git ls-tree could not list the declaration snapshots of ${tree.commit}.`);
  return listing.split('\0').filter((path) => path.startsWith(`${tree.folder}/`));
}

export function committedSnapshots(root: string, tree: SnapshotTree, modules: readonly string[]): Map<string, string> {
  const paths = modules.map((module) => [module, snapshotPathOf(tree.folder, module)] as const);
  const blobs = blobsAt(root, tree.commit, paths.map(([, path]) => path));
  const snapshots = new Map<string, string>();
  for (const [module, path] of paths) {
    const text = blobs.get(path);
    if (text !== undefined) snapshots.set(module, text);
  }
  return snapshots;
}

// When the folder moved, the two paths differ, so git compares the two blobs.
export function snapshotDiff(root: string, trees: SnapshotTrees, module: string): string {
  const before = snapshotPathOf(trees.base.folder, module);
  const after = snapshotPathOf(trees.head.folder, module);
  const range = before === after ? [trees.base.commit, trees.head.commit, '--', after] : [`${trees.base.commit}:${before}`, `${trees.head.commit}:${after}`];
  return git(root, ['-c', 'core.quotePath=false', 'diff', ...diffOptions, ...range], `git diff could not compare the declaration snapshots of ${module}.`);
}

// The hunks of a diff of one file start at its first @@ line. The --- and +++ lines before that line are headers.
export function lineCountsOf(diff: string): { readonly added: number; readonly removed: number } {
  const lines = diff.split('\n');
  const start = lines.findIndex((line) => line.startsWith('@@'));
  const hunks = start < 0 ? [] : lines.slice(start);
  return { added: hunks.filter((line) => line.startsWith('+')).length, removed: hunks.filter((line) => line.startsWith('-')).length };
}

// A last line without a new line counts too.
export function lineCountOf(text: string): number {
  if (text === '') return 0;
  return text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
}
