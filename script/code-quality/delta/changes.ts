import { CommandError } from '../shared/repository.ts';

export interface FileChange {
  readonly status: 'A' | 'M' | 'D' | 'R';
  readonly path: string;
  readonly oldPath?: string;
}

export function supportedPath(path: string): boolean {
  return /\.(?:ts|tsx|mts|cts)$/u.test(path) && !path.includes('\0') && !path.split('/').some((part) => part === '' || part === '.' || part === '..');
}

export function validateChanges(changes: readonly FileChange[]): FileChange[] {
  const predecessors = new Set<string>();
  const destinations = new Set<string>();
  for (const change of changes) {
    const predecessor = change.status === 'A' ? undefined : change.oldPath ?? change.path;
    const destination = change.status === 'D' ? undefined : change.path;
    claimPath(predecessors, predecessor);
    claimPath(destinations, destination);
  }
  return [...changes];
}

function claimPath(paths: Set<string>, path: string | undefined): void {
  if (path === undefined) return;
  if (paths.has(path)) throw new CommandError(`Conflicting file changes for ${path}.`);
  paths.add(path);
}
