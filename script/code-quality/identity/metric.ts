import type { FunctionIdentity } from './types.ts';

const classMembers = new Set(['MethodDeclaration', 'GetAccessor', 'SetAccessor', 'Constructor']);
const classPrefix = 'ClassDeclaration:';

export function metricMatchesIdentity(name: string, identity: FunctionIdentity): boolean {
  const metric = name.slice(name.lastIndexOf('\\') + 1);
  if (metric === identity.name) return true;
  if (!classMembers.has(identity.kind)) return false;
  const owner = identity.owner.split('/').at(-1) ?? '';
  return owner.startsWith(classPrefix) && metric === `${owner.slice(classPrefix.length)}.${identity.name}`;
}
