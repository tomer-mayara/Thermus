import { writeSync } from 'node:fs';
import type { ArchitectureCommand } from './command-line.ts';
import { coverageOfRepository } from './coverage.ts';
import * as coverage from './coverage-compatibility.ts';
import type { MapSources } from './types.ts';
import { snapshotSourcesOf } from './sources.ts';
import { repositoryRoot } from '../shared/repository.ts';

type ReportCommand = Extract<ArchitectureCommand, { readonly kind: 'report' }>;

export async function mapSourcesOf({ source, touched, changes, coverage: file, noCoverage }: ReportCommand): Promise<MapSources> {
  const root = source.kind === 'repository' ? repositoryRoot() : undefined;
  // Validate coverage before costly analysis. A skip must not read the default report.
  const report = noCoverage ? undefined : coverageOfRepository(root, file);
  const sources = await snapshotSourcesOf({ source, touched, changes }, root, notice);
  const selected = coverage.coverageForHead(report, sources.head.provenance, noCoverage);
  const diagnostic = coverage.coverageDiagnosticOf(selected);
  if (diagnostic !== undefined) notice(diagnostic);
  return { ...sources, ...selected };
}

// The line goes out at once, because a signal ends the process right after it.
function notice(line: string): void {
  writeSync(process.stderr.fd, `ast-metrics-architecture: ${line}\n`);
}
