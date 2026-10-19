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
import { testChangesOnlyInPaths, testChangesOnlyInRepository } from './test-changes.ts';
import type { MapSnapshot } from './types.ts';

type SnapshotOptions = Pick<Extract<ArchitectureCommand, { readonly kind: 'report' }>, 'source' | 'touched' | 'changes'>;

export async function snapshotSourcesOf(options: SnapshotOptions, repository: string | undefined, notice: (line: string) => void) {
  const { source } = options;
  return source.kind === 'files'
    ? snapshotsInFiles(source, options)
    : snapshotsInRepository(source, options.touched, { repository, notice });
}

function snapshotsInFiles(source: Extract<SnapshotOptions['source'], { kind: 'files' }>, { touched, changes: file }: Pick<SnapshotOptions, 'touched' | 'changes'>) {
  // Offline identities belong to the supplied snapshots; this branch must not read Git.
  const base = snapshotInFile(source.base);
  const head = snapshotInFile(source.head);
  const changes = file === undefined ? undefined : changesInFile(file, base, head);
  const changedPaths = touchedPaths(changes ?? []);
  const paths = touched ?? changedPaths;
  return { base, head, changes, touched: paths, testChangesOnly: offlineTestChangesOnly(base, head, [...paths, ...changedPaths]) };
}

function offlineTestChangesOnly(base: MapSnapshot, head: MapSnapshot, paths: readonly string[]): boolean {
  return base.provenance !== undefined && head.provenance !== undefined
    && base.provenance.sourceFingerprint === head.provenance.sourceFingerprint
    && testChangesOnlyInPaths(paths);
}

async function snapshotsInRepository(source: Extract<SnapshotOptions['source'], { kind: 'repository' }>, touched: SnapshotOptions['touched'], { repository, notice }: { repository: string | undefined; notice: (line: string) => void }) {
  const root = repository ?? repositoryContext.repositoryRoot();
  repositoryContext.verifyBase(root, source.ref);
  const checked = cliToolVersion(root, source.allowToolVersion);
  const base = await snapshotOfBase({ toolVersion: checked, root, ref: source.ref, timeoutMs: source.timeoutMs, notice });
  const changes = changesInSource(deltaChanges(root, source.ref));
  return { base, head: await snapshotOfTree(root, source.timeoutMs, checked), changes, touched: touched ?? touchedPaths(changes), testChangesOnly: testChangesOnlyInRepository(root, source.ref) };
}

function touchedPaths(changes: readonly FileChange[]): string[] {
  return [...new Set(changes.flatMap((change) => change.oldPath === undefined ? [change.path] : [change.oldPath, change.path]))].sort();
}
