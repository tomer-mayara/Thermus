import { correspondenceOf } from '../architecture/correspondence.ts';
import { coverageShareOf, fileCrapOf } from '../architecture/crap.ts';
import type { MapSnapshot, MapSources, TableFile } from '../architecture/types.ts';
import type { CoverageReport } from '../architecture/coverage.ts';
import type { Selection } from './selection.ts';
import type { GoalFunction } from './types.ts';

interface SourceFiles { readonly base: readonly TableFile[]; readonly head: readonly TableFile[] }

// A function without source identity gets a placeholder that keeps the order of equal rows stable.
const placeholder = 'metric:';

export function goalFunctionsOf(selection: Selection, files: SourceFiles, coverage: CoverageReport): GoalFunction[] {
  const sources: MapSources = { base: snapshot(files.base), head: snapshot(files.head), changes: selection.changes, touched: selection.paths };
  const correspondence = correspondenceOf(sources);
  const selected = new Set(selection.paths);
  const covered = new Map(coverage.files.map((file) => [file.path, file.functions]));
  return files.head.filter(({ path }) => selected.has(path)).flatMap((file) => {
    const measured = fileCrapOf(file, coverageShareOf(covered.get(file.path), file));
    return measured.functions.map((fn, index): GoalFunction => {
      const source = file.functions?.[index];
      return { ...fn, file: file.path, change: source === undefined ? 'unknown' : correspondence.head.get(source)?.classification ?? 'unknown', identity: source?.identity === undefined ? `${placeholder}${index}` : JSON.stringify(source.identity) };
    });
  });
}

export function sourceIdentityOf(entry: GoalFunction): string | undefined {
  return entry.identity.startsWith(placeholder) ? undefined : entry.identity;
}

function snapshot(files: readonly TableFile[]): MapSnapshot {
  return { commit: '', date: '', files, communities: [], global: { modularity: 0, crossShare: 0, cycles: [], paths: 0, files: files.length, functions: 0 } };
}
