import { isJsonObject } from '../shared/json.ts';
import { pairIn, invalid } from './read-values.ts';
import { issueIn } from './read-issue.ts';
import type { DependencyEvidence } from './types.ts';

export function dependenciesIn(value: unknown, paths: readonly string[]): DependencyEvidence | undefined {
  if (value === undefined) return undefined;
  if (!isJsonObject(value) || value.version !== 1 || !Array.isArray(value.pairs) || !Array.isArray(value.issues)) invalid();
  const known = new Set(paths);
  const pairs = value.pairs.map((pair) => pairIn(pair, known));
  if (new Set(pairs.map((pair) => JSON.stringify([pair.from, pair.to]))).size !== pairs.length) invalid();
  const issues = value.issues.map((issue) => issueIn(issue, known));
  if (new Set(issues.map((issue) => JSON.stringify(issue))).size !== issues.length) invalid();
  return { version: 1, pairs, issues };
}
