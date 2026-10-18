// A file of src/ that no process of the run loaded is not in the report: the coverage files do not name it.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { MergedCoverage, MergedFunction, MergedScript } from './ast-metrics-coverage-merge.ts';
import { CommandError } from './repository.ts';

type FunctionCoverage = { readonly name: string; readonly start: number; readonly end: number; readonly called: number; readonly coveredShare: number };
type FileCoverage = { readonly path: string; readonly functions: readonly FunctionCoverage[] };

// suite: the suite whose run gave the coverage. processes: the coverage files that the command read. scripts: the
// scripts of the build of src/ in them.
type CoverageReport = {
  readonly version: 1; readonly suite: 'unit'; readonly commit: string;
  readonly processes: number; readonly scripts: number; readonly files: readonly FileCoverage[];
};

// The files come in the order of their paths and the functions in the order of their start, so that two reports
// of one tree are equal and two reports of two trees give a short diff.
export function writeCoverageReport(file: string, commit: string, { processes, scripts }: MergedCoverage): CoverageReport {
  const files = [...scripts].map(([path, script]) => fileCoverageOf(path, script)).sort((first, second) => (first.path < second.path ? -1 : 1));
  const report: CoverageReport = { version: 1, suite: 'unit', commit, processes, scripts: scripts.size, files };
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  } catch {
    throw new CommandError(`Cannot write the report ${file}.`);
  }
  return report;
}

// A function that starts where another starts is inside it, so the longer one comes first.
function fileCoverageOf(path: string, { functions }: MergedScript): FileCoverage {
  return { path, functions: [...functions.values()].sort((first, second) => first.start - second.start || second.end - first.end).map(functionCoverageOf) };
}

// A function without characters gets the share 0, not NaN, which JSON cannot hold.
function functionCoverageOf({ name, start, end, called, covered }: MergedFunction): FunctionCoverage {
  const ran = covered.reduce((sum, value) => sum + value, 0);
  return { name: name || '(anonymous)', start, end, called, coveredShare: Math.round((ran / Math.max(covered.length, 1)) * 1000) / 1000 };
}
