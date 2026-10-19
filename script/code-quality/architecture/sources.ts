import { cliToolVersion } from '../shared/tool-version.ts';
import type { ArchitectureCommand } from './command-line.ts';
import { snapshotInFile } from './file.ts';
import { changesInFile } from './changes.ts';
import { deltaChanges } from '../delta/files.ts';
import type { FileChange } from '../delta/changes.ts';
import { changesInSource } from '../delta/source.ts';
import { snapshotOfBase } from '../snapshot/base.ts';
import { snapshotOfTree } from '../snapshot/tree.ts';
import * as repositoryContext from '../shared/repository.ts';

type SnapshotOptions = Pick<Extract<ArchitectureCommand, { readonly kind: 'report' }>, 'source' | 'touched' | 'changes'>;

export async function snapshotSourcesOf({ source, touched, changes: file }: SnapshotOptions, repository: string | undefined, notice: (line: string) => void) {
  // Offline identities belong to the supplied snapshots; this branch must not read Git.
  if (source.kind === 'files') {
    const base = snapshotInFile(source.base);
    const head = snapshotInFile(source.head);
    const changes = file === undefined ? undefined : changesInFile(file, base, head);
    return { base, head, changes, touched: touched ?? touchedPaths(changes ?? []) };
  }
  const root = repository ?? repositoryContext.repositoryRoot();
  repositoryContext.verifyBase(root, source.ref);
  const checked = cliToolVersion(root, source.allowToolVersion);
  const base = await snapshotOfBase({ toolVersion: checked, root, ref: source.ref, timeoutMs: source.timeoutMs, notice });
  const changes = changesInSource(deltaChanges(root, source.ref));
  return { base, head: await snapshotOfTree(root, source.timeoutMs, checked), changes, touched: touched ?? touchedPaths(changes) };
}

function touchedPaths(changes: readonly FileChange[]): string[] {
  return [...new Set(changes.flatMap((change) => change.oldPath === undefined ? [change.path] : [change.oldPath, change.path]))].sort();
}
