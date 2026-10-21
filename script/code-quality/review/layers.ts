import type { DependencyPair } from '../dependencies/types.ts';
import { CommandError } from '../shared/repository.ts';
import type { JsonObject } from '../shared/json.ts';
import { comparisonTrees, type LayerComparison } from './layer-tree.ts';
import { componentOf, type ComponentDefinitions } from '../../component-ownership.ts';

const rules = [
  { from: ['html-cleaner-pipeline', 'html-processing'], to: ['mcp'] },
  { from: ['website-fetcher'], to: ['auth', 'identity', 'workos', 'better-auth', 'web', 'cli'] },
] as const;

function includes(owners: readonly string[], path: string, ownership?: ComponentDefinitions): boolean { return owners.includes(componentOf(path, ownership) ?? ''); }
function guarded(path: string, ownership?: ComponentDefinitions): boolean { return rules.some((rule) => includes(rule.from, path, ownership)); }
function forbidden(pair: DependencyPair, ownership?: ComponentDefinitions): boolean { return rules.some((rule) => includes(rule.from, pair.from, ownership) && includes(rule.to, pair.to, ownership)); }
function pairKey(pair: Pick<DependencyPair, 'from' | 'to'>): string { return JSON.stringify([pair.from, pair.to]); }
export function layerRegressions(root: string, base: string): readonly JsonObject[] {
  const comparison = comparisonTrees(root, base, guarded);
  const { before, head, after } = comparison;
  // Filter before translating moves. Moving an allowed edge across a forbidden
  // component boundary creates a violation, even if its import text is unchanged.
  const oldPairs = new Set(before.pairs.filter((pair) => forbidden(pair, comparison.beforeOwnership)).map((pair) => pairKey({ from: after(pair.from), to: after(pair.to) })));
  const added = head.pairs.filter((pair) => forbidden(pair, comparison.headOwnership) && !oldPairs.has(pairKey(pair)));
  assertCertain(comparison, added);
  return added.map((pair) => ({
    kind: 'regression', severity: 'high', rule: 'forbidden-component-dependency', file: pair.from,
    target: pair.to, kinds: pair.kinds, source: 'thermus-resolved-imports',
    message: `Forbidden component dependency: ${pair.from} → ${pair.to}`,
    suggestion: 'Remove the dependency or move this collaboration to an allowed component.', before: 0, after: 1,
  }));
}

function affectedSources({ changes, headPaths, before, head, after, beforeOwnership, headOwnership }: LayerComparison, added: readonly DependencyPair[]): ReadonlySet<string> {
  const affected = new Set(changes.filter((change) => change.status !== 'D').map((change) => change.path).filter((path) => guarded(path, headOwnership)));
  for (const pair of added) affected.add(pair.from);
  const oldIssues = new Set(before.issues.map((issue) => JSON.stringify({ ...issue, path: after(issue.path) })));
  for (const issue of head.issues) if (!oldIssues.has(JSON.stringify(issue))) affected.add(issue.path);
  for (const rule of rules) {
    if (changes.some((change) => includes(rule.to, change.path, headOwnership) || includes(rule.to, change.oldPath ?? change.path, beforeOwnership))) {
      for (const path of headPaths) if (includes(rule.from, path, headOwnership)) affected.add(path);
    }
  }
  return affected;
}

function assertCertain(comparison: LayerComparison, added: readonly DependencyPair[]): void {
  const { before, head, after, headPaths } = comparison;
  const affected = affectedSources(comparison, added);
  const uncertain = [...before.issues.map((issue) => ({ ...issue, path: after(issue.path), tree: 'base' })), ...head.issues.map((issue) => ({ ...issue, tree: 'head' }))]
    .filter((issue) => affected.has(issue.path) && headPaths.includes(issue.path));
  if (uncertain.length) {
    const issue = uncertain[0];
    throw new CommandError(`Cannot assess layer rules for ${issue.path} (${issue.tree}): ${issue.reason}${issue.specifier === undefined ? '' : `: ${issue.specifier}`}.`);
  }
}
