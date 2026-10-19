import { posix } from 'node:path';
import type { DependencyIssueReason } from './types.ts';

export function canonicalSourcePath(path: unknown): path is string {
  return typeof path === 'string' && path.startsWith('src/') && !path.includes('\\') && !path.includes('\0')
    && posix.normalize(path) === path && path !== 'src/' && !path.endsWith('/');
}

export function targetOf(from: string, specifier: string, paths: ReadonlySet<string>): { target?: string; reason?: DependencyIssueReason } {
  if (specifier.startsWith('#')) return { reason: 'unsupported-alias' };
  if (specifier.startsWith('/') || specifier.includes('\\')) return { reason: 'outside-src' };
  if (!specifier.startsWith('.')) return {};
  const resolved = posix.normalize(posix.join(posix.dirname(from), specifier)).replace(/\/$/u, '');
  if (resolved !== 'src' && !canonicalSourcePath(resolved)) return { reason: 'outside-src' };
  const target = candidatesOf(resolved).find((candidate) => paths.has(candidate));
  return target ? { target } : { reason: 'unresolved-local' };
}

function candidatesOf(path: string): readonly string[] {
  const extension = posix.extname(path);
  if (extension === '.js') return [path.slice(0, -3) + '.ts'];
  if (extension) return [path];
  return [path + '.ts', path + '/index.ts'];
}
