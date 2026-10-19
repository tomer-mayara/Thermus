import { writeSync } from 'node:fs';
import type { ArchitectureCommand } from './command-line.ts';
import { coverageInFile, coverageOfRepository } from './coverage.ts';
import { coverageForHead, missingCoverage, skippedCoverage } from './coverage-compatibility.ts';
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
export async function mapSourcesOf(command: ReportCommand): Promise<MapSources> {
  const root = command.source.kind === 'repository' ? repositoryRoot() : undefined;
  const report = reportOf(command, root);
  const sources = await snapshotsOf(command, root);
  const selected = command.noCoverage ? { coverageNotice: skippedCoverage } : coverageForHead(report, sources.head.provenance);
  if (selected.coverageNotice !== undefined && selected.coverageNotice !== missingCoverage) notice(selected.coverageNotice);
  return { base: sources.base, head: sources.head, touched: sources.touched, ...selected };
}

async function snapshotsOf({ source, touched }: ReportCommand, repository: string | undefined) {
  if (source.kind === 'files') {
    return { base: snapshotInFile(source.base), head: snapshotInFile(source.head), touched: touched ?? [] };
  }
  const root = repository ?? repositoryRoot();
  const base = await snapshotOfBase({ root, ref: source.ref, timeoutMs: source.timeoutMs, notice });
  const changed = touched ?? deltaFiles(root, source.ref).filter((path) => path.startsWith('src/'));
  return { base, head: await snapshotOfTree(root, source.timeoutMs), touched: changed };
}

function reportOf({ coverage, noCoverage }: ReportCommand, root: string | undefined) {
  if (noCoverage) return undefined;
  if (root !== undefined) return coverageOfRepository(root, coverage);
  return coverage === undefined ? undefined : coverageInFile(coverage);
}

// The line goes out at once, because a signal ends the process right after it.
function notice(line: string): void {
  writeSync(process.stderr.fd, `ast-metrics-architecture: ${line}\n`);
}
