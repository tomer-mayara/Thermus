import { posix } from 'node:path';
import { targetOf } from '../code-quality/dependencies/resolve.ts';

// code holds the files that an import can name as a module; all holds every path under src/ at HEAD.
export interface SourceFiles {
  readonly code: ReadonlySet<string>;
  readonly all: ReadonlySet<string>;
}

export type Resolution = { readonly kind: 'target'; readonly path: string } | { readonly kind: 'asset' | 'unresolved' | 'external' };

// targetOf maps ".js" to ".ts" only. TypeScript also tries these files, and a JavaScript file can be a target.
const alternates: ReadonlyMap<string, readonly string[]> = new Map([
  ['.js', ['.tsx', '.d.ts', '.js']],
  ['.mjs', ['.mts', '.d.mts', '.mjs']],
  ['.cjs', ['.cts', '.d.cts', '.cjs']],
  ['.jsx', ['.tsx', '.jsx']],
  ['', ['.tsx', '.d.ts', '/index.tsx', '/index.d.ts']],
]);

// An import of a file that exists but is no module, such as a stylesheet, is an asset. Unresolved means that the
// target is missing, or that the check cannot follow the specifier.
export function resolutionOf(from: string, specifier: string, files: SourceFiles): Resolution {
  const { target, reason } = targetOf(from, specifier, files.code);
  if (target) return { kind: 'target', path: target };
  if (reason === undefined) return { kind: 'external' };
  if (reason !== 'unresolved-local') return { kind: 'unresolved' };
  const path = posix.normalize(posix.join(posix.dirname(from), specifier)).replace(/\/$/u, '');
  const alternate = candidatesOf(path).find((candidate) => files.code.has(candidate));
  if (alternate) return { kind: 'target', path: alternate };
  return { kind: files.all.has(path) ? 'asset' : 'unresolved' };
}

function candidatesOf(path: string): string[] {
  const extension = posix.extname(path);
  const stem = path.slice(0, path.length - extension.length);
  return (alternates.get(extension) ?? []).map((ending) => stem + ending);
}
