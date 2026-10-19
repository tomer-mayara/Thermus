import { isJsonObject, textOf } from '../shared/json.ts';
import { knownPath, invalid } from './read-values.ts';
import type { DependencyIssue, DependencyIssueReason } from './types.ts';

const reasons = new Set<DependencyIssueReason>(['unresolved-local', 'non-literal-dynamic', 'unsupported-alias', 'parse-error', 'outside-src']);

export function issueIn(value: unknown, paths: ReadonlySet<string>): DependencyIssue {
  if (!isJsonObject(value) || !knownPath(value.path, paths) || !isReason(value.reason)) invalid();
  const needsSpecifier = ['unresolved-local', 'unsupported-alias', 'outside-src'].includes(value.reason);
  const specifier = textOf(value.specifier);
  if (value.specifier !== undefined && !specifier) invalid();
  if (needsSpecifier && value.specifier === undefined) invalid();
  return { path: value.path, reason: value.reason, ...(specifier === undefined ? {} : { specifier }) };
}

function isReason(value: unknown): value is DependencyIssueReason {
  return reasons.has(value as DependencyIssueReason);
}
