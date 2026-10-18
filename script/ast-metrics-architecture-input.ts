import { writeSync } from 'node:fs';
import type { ArchitectureCommand } from './ast-metrics-architecture-command-line.ts';
import { snapshotInFile } from './ast-metrics-architecture-file.ts';
import type { MapSources } from './ast-metrics-architecture-types.ts';
import { deltaFiles } from './ast-metrics-delta-files.ts';
import { snapshotOfBase } from './ast-metrics-snapshot-base.ts';
import { snapshotOfTree } from './ast-metrics-snapshot-tree.ts';
import { repositoryRoot } from './repository.ts';

type ReportCommand = Extract<ArchitectureCommand, { readonly kind: 'report' }>;

// Two snapshot files need no repository, so their changed files come from --touched alone. The changed files of a
// repository follow the delta rule of script/ast-metrics-delta.ts, for the files under src/.
export async function mapSourcesOf({ source, touched }: ReportCommand): Promise<MapSources> {
  if (source.kind === 'files') return { base: snapshotInFile(source.base), head: snapshotInFile(source.head), touched: touched ?? [] };
  const root = repositoryRoot();
  // The base goes first: it checks the ref, with the diagnostic of repository.ts, before any analysis runs.
  const base = await snapshotOfBase({ root, ref: source.ref, timeoutMs: source.timeoutMs, notice });
  const changed = touched ?? deltaFiles(root, source.ref).filter((path) => path.startsWith('src/'));
  return { base, head: await snapshotOfTree(root, source.timeoutMs), touched: changed };
}

// The line goes out at once, because a signal ends the process right after it.
function notice(line: string): void {
  writeSync(process.stderr.fd, `ast-metrics-architecture: ${line}\n`);
}
