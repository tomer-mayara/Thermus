import { writeSync } from 'node:fs';
import type { ArchitectureCommand } from './command-line.ts';
import { coverageOfRepository } from './coverage.ts';
import * as coverage from './coverage-compatibility.ts';
import { snapshotInFile } from './file.ts';
import type { MapSources } from './types.ts';
import { deltaFiles } from '../delta/files.ts';
import { snapshotOfBase } from '../snapshot/base.ts';
import { snapshotOfTree } from '../snapshot/tree.ts';
import { repositoryRoot } from '../shared/repository.ts';

type ReportCommand = Extract<ArchitectureCommand, { readonly kind: 'report' }>;

// Two snapshot files need no repository, so their changed files come from --touched alone and their coverage from
// --coverage alone. The changed files of a repository follow the delta rule of script/code-quality/ast-metrics-delta.ts, for the
// files under src/, and its coverage is ast-report/coverage.json of the root when --coverage does not name a file.
export async function mapSourcesOf({ source, touched, coverage: file, noCoverage }: ReportCommand): Promise<MapSources> {
  const root = source.kind === 'repository' ? repositoryRoot() : undefined;
  // Validate coverage before costly analysis. A skip must not read the default report.
  const report = noCoverage ? undefined : coverageOfRepository(root, file);
  const sources = await snapshotsOf(source, touched, root);
  const selected = coverage.coverageForHead(report, sources.head.provenance, noCoverage);
  const diagnostic = coverage.coverageDiagnosticOf(selected);
  if (diagnostic !== undefined) notice(diagnostic);
  return { ...sources, ...selected };
}

async function snapshotsOf(source: ReportCommand['source'], touched: ReportCommand['touched'], repository: string | undefined) {
  // Offline identities belong to the supplied snapshots; this branch must not read Git.
  if (source.kind === 'files') {
    return { base: snapshotInFile(source.base), head: snapshotInFile(source.head), touched: touched ?? [] };
  }
  const root = repository ?? repositoryRoot();
  const base = await snapshotOfBase({ root, ref: source.ref, timeoutMs: source.timeoutMs, notice });
  const changed = touched ?? deltaFiles(root, source.ref).filter((path) => path.startsWith('src/'));
  return { base, head: await snapshotOfTree(root, source.timeoutMs), touched: changed };
}

// The line goes out at once, because a signal ends the process right after it.
function notice(line: string): void {
  writeSync(process.stderr.fd, `ast-metrics-architecture: ${line}\n`);
}
