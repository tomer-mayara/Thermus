import type { ScriptIdentity } from './identity.ts';
import { coverageSourceFiles } from './source-files.ts';
import { sourceBindingsOf, type SourceBindings } from './source-bindings.ts';

// The cache belongs to one capture read; each lookup first checks live file hashes.
export function coverageSourceFunctions(root: string) {
  const cached = new Map<string, SourceBindings | undefined>();
  return {
    forScript(script: ScriptIdentity): SourceBindings | undefined {
      const files = coverageSourceFiles(root, script);
      if (!files) return undefined;
      if (!cached.has(files.cacheKey)) cached.set(files.cacheKey, sourceBindingsOf(files));
      return cached.get(files.cacheKey);
    },
  };
}
