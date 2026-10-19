import { textOrder } from '../shared/order.ts';
import { importsIn } from './parse.ts';
import { targetOf } from './resolve.ts';
import type { DependencyEvidence, DependencyIssue, DependencyKind, DependencyPair } from './types.ts';

interface Collection {
  readonly pairs: Map<string, { from: string; to: string; kinds: Set<DependencyKind> }>;
  readonly issues: Map<string, DependencyIssue>;
  readonly paths: ReadonlySet<string>;
}

export function dependenciesOf(texts: ReadonlyMap<string, string>, paths: readonly string[] = [...texts.keys()]): DependencyEvidence {
  const collection: Collection = { paths: new Set(paths), pairs: new Map(), issues: new Map() };
  for (const path of paths) collectSource({ path, text: texts.get(path) }, collection);
  const pairs: DependencyPair[] = [...collection.pairs.values()].map((pair) => ({ ...pair, kinds: [...pair.kinds].sort() }));
  pairs.sort((a, b) => textOrder(a.from, b.from) || textOrder(a.to, b.to));
  const issues = [...collection.issues.values()].sort((a, b) => textOrder(a.path, b.path) || textOrder(a.specifier ?? '', b.specifier ?? '') || textOrder(a.reason, b.reason));
  return { version: 1, pairs, issues };
}

function collectSource(source: { path: string; text?: string }, collection: Collection): void {
  const imports = source.text === undefined ? undefined : importsIn(source.path, source.text);
  if (!imports) return addIssue(collection, { path: source.path, reason: 'parse-error' });
  for (const reference of imports) {
    if (reference.specifier === undefined) {
      addIssue(collection, { path: source.path, reason: 'non-literal-dynamic' });
      continue;
    }
    const { target, reason } = targetOf(source.path, reference.specifier, collection.paths);
    if (reason) addIssue(collection, { path: source.path, specifier: reference.specifier, reason });
    if (target) addPair(collection, { from: source.path, to: target, kinds: reference.kinds });
  }
}

function addPair(collection: Collection, pair: DependencyPair): void {
  const key = JSON.stringify([pair.from, pair.to]);
  const found = collection.pairs.get(key) ?? { ...pair, kinds: new Set<DependencyKind>() };
  for (const kind of pair.kinds) found.kinds.add(kind);
  collection.pairs.set(key, found);
}

function addIssue(collection: Collection, issue: DependencyIssue): void {
  collection.issues.set(JSON.stringify(issue), issue);
}
