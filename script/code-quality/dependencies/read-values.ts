import { isJsonObject } from '../shared/json.ts';
import { canonicalSourcePath } from './resolve.ts';
import { CommandError } from '../shared/repository.ts';
import type { DependencyKind, DependencyPair } from './types.ts';

const kinds = new Set<DependencyKind>(['static', 'type', 're-export', 'side-effect', 'dynamic']);

export function pairIn(value: unknown, paths: ReadonlySet<string>): DependencyPair {
  if (!isJsonObject(value) || !knownPath(value.from, paths) || !knownPath(value.to, paths)) invalid();
  if (!Array.isArray(value.kinds) || !value.kinds.length || !value.kinds.every(isKind)) invalid();
  if (new Set(value.kinds).size !== value.kinds.length) invalid();
  return { from: value.from, to: value.to, kinds: value.kinds };
}

function isKind(value: unknown): value is DependencyKind {
  return kinds.has(value as DependencyKind);
}

export function knownPath(value: unknown, paths: ReadonlySet<string>): value is string {
  return canonicalSourcePath(value) && paths.has(value);
}

export function invalid(): never {
  throw new CommandError('Invalid snapshot dependency evidence.');
}
