import * as fs from 'node:fs';
import * as paths from 'node:path';
import { supportedPath, type FileChange } from '../delta/changes.ts';
import { deltaChanges } from '../delta/files.ts';
import { changesInSource } from '../delta/source.ts';
import * as repository from '../shared/repository.ts';
import type { CrapCommand } from './command-line.ts';

// base is the merge base, not the ref, so that a reader of the rows can name the commit.
export interface Selection { readonly root: string; readonly base: string; readonly head: string; readonly changes: readonly FileChange[]; readonly paths: readonly string[] }

export function selectionOf(command: Extract<CrapCommand, { kind: 'report' }>): Selection {
  const root = repository.repositoryRoot();
  repository.verifyBase(root, command.base);
  const changes = changesInSource(deltaChanges(root, command.base));
  const selected = command.paths.length === 0 ? changes.filter(({ status }) => status !== 'D').map(({ path }) => checkedSourcePath(root, paths.resolve(root, path))) : command.paths.map((path) => checkedSourcePath(root, path));
  const head = repository.git(root, ['rev-parse', '--verify', 'HEAD^{commit}'], 'Cannot resolve HEAD.').trim();
  const base = repository.git(root, ['merge-base', command.base, head], `Cannot resolve the merge base of ${command.base}.`).trim();
  return { root, base, head, changes, paths: [...new Set(selected)].sort() };
}

function checkedSourcePath(root: string, path: string): string {
  let absolute: string;
  try {
    absolute = fs.realpathSync(paths.resolve(path));
    if (!fs.statSync(absolute).isFile()) throw new Error('not a file');
  } catch {
    throw new repository.CommandError(`The path ${path} must name an existing source file in src/.`);
  }
  const name = paths.relative(root, absolute).split(paths.sep).join('/');
  if (!name.startsWith('src/') || !supportedPath(name) || name.split('/').some((part) => ['node_modules', '.git', 'dist', '.vite'].includes(part))) throw new repository.CommandError(`The path ${path} must name an existing source file in src/.`);
  return name;
}
