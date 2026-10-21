import { isBuiltin } from 'node:module';

// The name under which the rules file lists an external import. A Node builtin has the prefix node:, as the lists
// spell it, and keeps its subpath: fs is node:fs. An npm package is its package name: better-auth/oauth2 is
// better-auth, @scope/name/sub is @scope/name.
export function externalNameOf(specifier: string): { readonly name: string; readonly builtin: boolean } {
  if (isBuiltin(specifier)) return { name: specifier.startsWith('node:') ? specifier : `node:${specifier}`, builtin: true };
  const names = specifier.split('/');
  return { name: names.slice(0, specifier.startsWith('@') ? 2 : 1).join('/'), builtin: false };
}
