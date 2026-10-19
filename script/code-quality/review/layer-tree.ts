import * as fs from 'node:fs';
import { join } from 'node:path';
import { dependenciesOf } from '../dependencies/source.ts';
import type { DependencyEvidence } from '../dependencies/types.ts';
import { supportedPath, type FileChange } from '../delta/changes.ts';
import { deltaChanges } from '../delta/files.ts';
import * as repository from '../shared/repository.ts';
import { reviewMoves } from './moves.ts';

export interface LayerComparison {
  readonly changes: readonly FileChange[];
  readonly headPaths: readonly string[];
  readonly before: DependencyEvidence;
  readonly head: DependencyEvidence;
  readonly after: (path: string) => string;
}

function sourcePaths(text: string): string[] {
  return [...new Set(text.split('\0').filter((path) => path.startsWith('src/') && supportedPath(path)))].sort();
}

// Other known files supply CR-13's target inventory. Empty text keeps unrelated
// imports outside the guarded-source assessment.
function evidence(paths: readonly string[], read: (path: string) => string, guarded: (path: string) => boolean) {
  return dependenciesOf(new Map(paths.map((path) => [path, guarded(path) ? read(path) : ''])));
}

export function comparisonTrees(root: string, base: string, guarded: (path: string) => boolean): LayerComparison {
  const commit = repository.git(root, ['merge-base', 'HEAD', base], 'Cannot find the layer-rule comparison base.').trim();
  const changes = deltaChanges(root, base);
  const readBase = (path: string) => repository.git(root, ['show', `${commit}:${path}`], `Cannot read base layer-rule source ${path}.`);
  const moves = reviewMoves(changes, readBase, (path) => readSource(root, path));
  const after = (path: string) => moves.get(path) ?? path;
  const basePaths = sourcePaths(repository.git(root, ['ls-tree', '-r', '--name-only', '-z', commit, '--', 'src'], 'Cannot list base layer-rule sources.'));
  const headPaths = sourcePaths(repository.git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'src'], 'Cannot list current layer-rule sources.')).filter((path) => fs.existsSync(join(root, path)));
  return { changes, headPaths, before: evidence(basePaths, readBase, guarded), head: evidence(headPaths, (path) => readSource(root, path), guarded), after };
}

function readSource(root: string, path: string): string {
  try { return fs.readFileSync(join(root, path), 'utf8'); }
  catch { throw new repository.CommandError(`Cannot read layer-rule source ${path}.`); }
}
