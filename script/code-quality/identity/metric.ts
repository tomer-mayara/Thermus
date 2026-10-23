import { CommandError } from '../shared/repository.ts';
import { functionIdentityIn } from './read.ts';
import type { FunctionIdentity } from './types.ts';

const classMembers = new Set(['MethodDeclaration', 'GetAccessor', 'SetAccessor', 'Constructor']);
const classPrefix = 'ClassDeclaration:';

function metricMatchesIdentity(name: string, identity: FunctionIdentity): boolean {
  const metric = name.slice(name.lastIndexOf('\\') + 1);
  if (metric === identity.name) return true;
  if (!classMembers.has(identity.kind)) return false;
  const owner = identity.owner.split('/').at(-1) ?? '';
  return owner.startsWith(classPrefix) && metric === `${owner.slice(classPrefix.length)}.${identity.name}`;
}

export function identityForMetric(name: string, value: unknown): FunctionIdentity | undefined {
  const identity = functionIdentityIn(value);
  // Version 2 binds metrics to checked source ranges. Native callback names can
  // omit a variable binding or repeat a class prefix, so they are display text.
  if (identity?.version === 'typescript-tokens-v2') return identity;
  if (identity && !metricMatchesIdentity(name, identity)) {
    throw new CommandError('The snapshot binds a metric name to an unrelated source identity.');
  }
  return identity;
}
