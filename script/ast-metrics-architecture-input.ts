import { writeSync } from 'node:fs';
import type { ArchitectureCommand } from './ast-metrics-architecture-command-line.ts';
import { coverageInFile, coverageOfRepository } from './ast-metrics-architecture-coverage.ts';
import { snapshotInFile } from './ast-metrics-architecture-file.ts';
import type { MapSources } from './ast-metrics-architecture-types.ts';
import { deltaFiles } from './ast-metrics-delta-files.ts';
import { snapshotOfBase } from './ast-metrics-snapshot-base.ts';
import { snapshotOfTree } from './ast-metrics-snapshot-tree.ts';
import { repositoryRoot } from './repository.ts';

type ReportCommand = Extract<ArchitectureCommand, { readonly kind: 'report' }>;

// Two snapshot files need no repository, so their changed files come from --touched alone and their coverage from
// --coverage alone. The changed files of a repository follow the delta rule of script/ast-metrics-delta.ts, for the
// files under src/, and its coverage is ast-report/coverage.json of the root when --coverage does not name a file.
export async function mapSourcesOf({ source, touched, coverage: file }: ReportCommand): Promise<MapSources> {
  if (source.kind === 'files') {
    const coverage = file === undefined ? undefined : coverageInFile(file);
    return { base: snapshotInFile(source.base), head: snapshotInFile(source.head), touched: touched ?? [], coverage };
  }
  const root = repositoryRoot();
  // The coverage goes before the snapshots, so that a wrong report fails before any analysis runs. The base goes next: it
  // checks the ref, with the diagnostic of repository.ts.
  const coverage = coverageOfRepository(root, file);
  const base = await snapshotOfBase({ root, ref: source.ref, timeoutMs: source.timeoutMs, notice });
  const changed = touched ?? deltaFiles(root, source.ref).filter((path) => path.startsWith('src/'));
  return { base, head: await snapshotOfTree(root, source.timeoutMs), touched: changed, coverage };
}

// The line goes out at once, because a signal ends the process right after it.
function notice(line: string): void {
  writeSync(process.stderr.fd, `ast-metrics-architecture: ${line}\n`);
}
