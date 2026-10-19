import { writeSync } from 'node:fs';
import type { ArchitectureCommand } from './command-line.ts';
import { coverageOfRepository } from './coverage.ts';
import * as coverage from './coverage-compatibility.ts';
import { snapshotInFile } from './file.ts';
import { changesInFile } from './changes.ts';
import type { MapSources } from './types.ts';
import { deltaChanges } from '../delta/files.ts';
import type { FileChange } from '../delta/changes.ts';
import { changesInSource } from '../delta/source.ts';
import { snapshotOfBase } from '../snapshot/base.ts';
import { snapshotOfTree } from '../snapshot/tree.ts';
import { repositoryRoot } from '../shared/repository.ts';

type ReportCommand = Extract<ArchitectureCommand, { readonly kind: 'report' }>;

// Offline files use their own identities and optional change evidence. Repository
// mode uses Git status for src/ and defaults to ast-report/coverage.json.
export async function mapSourcesOf({ source, touched, changes, coverage: file, noCoverage }: ReportCommand): Promise<MapSources> {
  const root = source.kind === 'repository' ? repositoryRoot() : undefined;
  // Validate coverage before costly analysis. A skip must not read the default report.
  const report = noCoverage ? undefined : coverageOfRepository(root, file);
  const sources = await snapshotsOf({ source, touched, changeFile: changes }, root);
  const selected = coverage.coverageForHead(report, sources.head.provenance, noCoverage);
  const diagnostic = coverage.coverageDiagnosticOf(selected);
  if (diagnostic !== undefined) notice(diagnostic);
  return { ...sources, ...selected };
}

type SnapshotOptions = Pick<ReportCommand, 'source' | 'touched'> & { readonly changeFile?: string };

async function snapshotsOf({ source, touched, changeFile }: SnapshotOptions, repository: string | undefined) {
  // Offline identities belong to the supplied snapshots; this branch must not read Git.
  if (source.kind === 'files') {
    const base = snapshotInFile(source.base);
    const head = snapshotInFile(source.head);
    const changes = changeFile === undefined ? undefined : changesInFile(changeFile, base, head);
    return { base, head, changes, touched: touched ?? touchedPaths(changes ?? []) };
  }
  const root = repository ?? repositoryRoot();
  const base = await snapshotOfBase({ root, ref: source.ref, timeoutMs: source.timeoutMs, notice });
  const changes = changesInSource(deltaChanges(root, source.ref));
  return { base, head: await snapshotOfTree(root, source.timeoutMs), changes, touched: touched ?? touchedPaths(changes) };
}

function touchedPaths(changes: readonly FileChange[]): string[] {
  return [...new Set(changes.flatMap((change) => change.oldPath === undefined ? [change.path] : [change.oldPath, change.path]))].sort();
}

// The line goes out at once, because a signal ends the process right after it.
function notice(line: string): void {
  writeSync(process.stderr.fd, `ast-metrics-architecture: ${line}\n`);
}
