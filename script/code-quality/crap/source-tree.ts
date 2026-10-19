import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TableFile } from '../architecture/types.ts';
import { supportedPath } from '../delta/changes.ts';
import { treeEntries } from '../provenance/tree.ts';
import * as repository from '../shared/repository.ts';
import type { SnapshotFunction } from '../snapshot/types.ts';
import type { Selection } from './selection.ts';
import { sourceFileOf } from './source-evidence.ts';

export function sourceFilesOf(selection: Selection): { readonly base: TableFile[]; readonly head: TableFile[] } {
  const { root, base } = selection;
  const before = repository.git(root, ['ls-tree', '-r', '--name-only', '-z', base, '--', 'src'], 'Cannot list the base source files.').split('\0').filter((path) => path !== '' && supportedPath(path));
  const after = treeEntries(root, sourcePath).map(([path]) => path).filter((path) => path.startsWith('src/') && supportedPath(path));
  return {
    base: before.map((path) => sourceFileOf(path, repository.git(root, ['show', `${base}:${path}`], `Cannot read base source evidence for ${path}.`))),
    head: after.map((path) => sourceFileOf(path, currentText(root, path))),
  };
}

function sourcePath(path: string): boolean {
  if (['node_modules', '.git', 'dist', '.vite'].some((name) => path.split('/').includes(name))) return false;
  return path === 'src' || path.startsWith('src/');
}

function currentText(root: string, path: string): string {
  try { return readFileSync(join(root, path), 'utf8'); }
  catch { throw new repository.CommandError(`Cannot read source evidence for ${path}.`); }
}

export function measuredSourceFile(root: string, path: string, functions: readonly SnapshotFunction[]): TableFile {
  return sourceFileOf(path, currentText(root, path), functions);
}
