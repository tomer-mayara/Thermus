import { createRequire } from 'node:module';
import { fingerprintOf, treeEntries } from './tree.ts';
import type { InputIdentity } from './types.ts';

const require = createRequire(import.meta.url);
const compiler = `typescript-${(require('typescript/package.json') as { version: string }).version}`;
const excludedNames = new Set(['node_modules', '.git', '.DS_Store']);
function generated(path: string): boolean {
  if (path.split('/').some((part) => excludedNames.has(part))) return true;
  return ['dist', 'ast-report', 'coverage', 'src/user-portal/dist', 'src/user-portal/.vite'].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
const directories = new Set(['src', 'test', 'script', 'patches', 'migrations', 'docker', '.github', '.habit-hooks']);
function accepted(path: string): boolean {
  const parts = path.split('/');
  if (generated(path)) return false;
  if (path === 'docs' || path === 'docs/lightpanda-runtime.md') return true;
  if (parts[0] === 'docs') return false;
  if (directories.has(parts[0]) && path.endsWith('.md') && !['src', 'test'].includes(parts[0])) return false;
  if (directories.has(parts[0])) return true;
  return parts.length === 1 && !/\.(md|txt|log)$/.test(path);
}
export function sourceFingerprintOf(root: string): string {
  return fingerprintOf(treeEntries(root, (path) => path === 'src' || (path.startsWith('src/') && !generated(path))));
}
export function inputIdentityOf(root: string): InputIdentity {
  const metadata = { runtime: `node-${process.versions.node}`, compiler, measurementVersion: 'own-characters-1', suite: 'unit' } as const;
  return {
    sourceFingerprint: sourceFingerprintOf(root),
    inputsFingerprint: fingerprintOf([...treeEntries(root, accepted), ['\0measurement', Buffer.from(JSON.stringify(metadata))]]),
    ...metadata,
  };
}
