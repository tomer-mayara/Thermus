import type { DependencyPair } from '../dependencies/types.ts';
import { CommandError } from '../shared/repository.ts';
import type { JsonObject } from '../shared/json.ts';
import { comparisonTrees, type LayerComparison } from './layer-tree.ts';

const rules = [
  { from: 'src/html-cleaner-pipeline/', to: 'src/mcp/' },
  { from: 'src/website-fetcher/', to: 'src/auth/' },
] as const;

function guarded(path: string): boolean { return rules.some((rule) => path.startsWith(rule.from)); }
function forbidden(pair: DependencyPair): boolean { return rules.some((rule) => pair.from.startsWith(rule.from) && pair.to.startsWith(rule.to)); }
function pairKey(pair: Pick<DependencyPair, 'from' | 'to'>): string { return JSON.stringify([pair.from, pair.to]); }
export function layerRegressions(root: string, base: string): readonly JsonObject[] {
  const comparison = comparisonTrees(root, base, guarded);
  const { before, head, after } = comparison;
  // Filter before translating moves. Moving an allowed edge across a forbidden
  // component boundary creates a violation, even if its import text is unchanged.
  const oldPairs = new Set(before.pairs.filter(forbidden).map((pair) => pairKey({ from: after(pair.from), to: after(pair.to) })));
  const added = head.pairs.filter((pair) => forbidden(pair) && !oldPairs.has(pairKey(pair)));
  assertCertain(comparison, added);
  return added.map((pair) => ({
    kind: 'regression', severity: 'high', rule: 'forbidden-component-dependency', file: pair.from,
    target: pair.to, kinds: pair.kinds, source: 'thermus-resolved-imports',
    message: `Forbidden component dependency: ${pair.from} → ${pair.to}`,
    suggestion: 'Remove the dependency or move this collaboration to an allowed component.', before: 0, after: 1,
  }));
}

function affectedSources({ changes, headPaths, before, head, after }: LayerComparison, added: readonly DependencyPair[]): ReadonlySet<string> {
  const affected = new Set(changes.filter((change) => change.status !== 'D').map((change) => change.path).filter(guarded));
  for (const pair of added) affected.add(pair.from);
  const oldIssues = new Set(before.issues.map((issue) => JSON.stringify({ ...issue, path: after(issue.path) })));
  for (const issue of head.issues) if (!oldIssues.has(JSON.stringify(issue))) affected.add(issue.path);
  for (const rule of rules) {
    if (changes.some((change) => [change.path, change.oldPath ?? ''].some((path) => path.startsWith(rule.to)))) {
      for (const path of headPaths) if (path.startsWith(rule.from)) affected.add(path);
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
