import * as fs from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { componentDefinitionsOf, componentOwnersOf, type ComponentDefinitions } from '../../component-ownership.ts';
import { blobsAt } from '../../pr-review/blobs.ts';
import { dependenciesOf } from '../dependencies/source.ts';
import type { DependencyEvidence } from '../dependencies/types.ts';
import { supportedPath, type FileChange } from '../delta/changes.ts';
import { deltaChanges } from '../delta/files.ts';
import * as repository from '../shared/repository.ts';
import { reviewMoves } from './moves.ts';

export interface LayerComparison {
  readonly beforeOwnership?: ComponentDefinitions;
  readonly headOwnership?: ComponentDefinitions;
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

export function comparisonTrees(root: string, base: string, guarded: (path: string, ownership?: ComponentDefinitions) => boolean): LayerComparison {
  const commit = repository.git(root, ['merge-base', 'HEAD', base], 'Cannot find the layer-rule comparison base.').trim();
  const changes = deltaChanges(root, base);
  const readBase = (path: string) => repository.git(root, ['show', `${commit}:${path}`], `Cannot read base layer-rule source ${path}.`);
  const moves = reviewMoves(changes, readBase, (path) => readSource(root, path));
  const after = (path: string) => moves.get(path) ?? path;
  const basePaths = sourcePaths(repository.git(root, ['ls-tree', '-r', '--name-only', '-z', commit, '--', 'src'], 'Cannot list base layer-rule sources.'));
  const headPaths = sourcePaths(repository.git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'src'], 'Cannot list current layer-rule sources.')).filter((path) => fs.existsSync(join(root, path)));
  const policyPath = 'docs/implementation/pr-review-rules.yaml';
  const beforeOwnership = ownershipIn(blobsAt(root, commit, [policyPath]).get(policyPath));
  const headOwnership = ownershipIn(fs.existsSync(join(root, policyPath)) ? readSource(root, policyPath) : undefined);
  if (beforeOwnership !== undefined) componentOwnersOf(basePaths, beforeOwnership);
  if (headOwnership !== undefined) componentOwnersOf(headPaths, headOwnership);
  return { changes, headPaths, beforeOwnership, headOwnership,
    before: evidence(basePaths, readBase, (path) => guarded(path, beforeOwnership)),
    head: evidence(headPaths, (path) => readSource(root, path), (path) => guarded(path, headOwnership)), after };
}

function ownershipIn(text: string | undefined): ComponentDefinitions | undefined {
  return text === undefined ? undefined : componentDefinitionsOf(parse(text)?.dependency_graph?.components, 'Layer policy');
}

function readSource(root: string, path: string): string {
  try { return fs.readFileSync(join(root, path), 'utf8'); }
  catch { throw new repository.CommandError(`Cannot read layer-rule source ${path}.`); }
}
