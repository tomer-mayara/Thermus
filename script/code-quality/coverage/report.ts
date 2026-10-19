// A file of src/ that no process of the run loaded is not in the report: the coverage files do not name it.
import { textOrder } from '../shared/order.ts';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import type { CoverageProvenance, CoverageSuite } from '../provenance/types.ts';
import type { MergedCoverage, MergedFunction, MergedScript } from './merge.ts';
import { CommandError } from '../shared/repository.ts';

type FunctionCoverage = { readonly name: string; readonly start: number; readonly end: number; readonly called: number; readonly coveredShare: number };
type FileCoverage = { readonly path: string; readonly representation: MergedScript['representation']; readonly contentIdentity: string; readonly functions: readonly FunctionCoverage[] };
type UnmeasuredFunction = { readonly path: string; readonly name: string; readonly start: number; readonly end: number; readonly reason: 'no-own-characters' };

// suite: the suite whose run gave the coverage. processes: the coverage files that the command read. scripts: the
// scripts of the build of src/ in them.
type CoverageReport = {
  readonly version: 2; readonly measurementVersion: 'own-characters-1'; readonly unmeasuredFunctions: readonly UnmeasuredFunction[]; readonly suite: CoverageSuite | readonly CoverageSuite[]; readonly commit: string | null; readonly provenance: CoverageProvenance;
  readonly processes: number; readonly scripts: number; readonly files: readonly FileCoverage[];
};

// The files come in the order of their paths and the functions in the order of their start, so that two reports
// of one tree are equal and two reports of two trees give a short diff.
export function writeCoverageReport(file: string, origin: { commit: string | null; provenance: CoverageProvenance; suite?: CoverageSuite | readonly CoverageSuite[] }, { processes, scripts }: MergedCoverage): CoverageReport {
  const files = [...scripts].map(([path, script]) => fileCoverageOf(path, script)).sort((first, second) => textOrder(first.path, second.path));
  const unmeasuredFunctions = [...scripts].sort(([first], [second]) => textOrder(first, second)).flatMap(([path, script]) => orderedFunctions(script).filter(({ ownCharacters }) => ownCharacters === 0).map(({ name, start, end }): UnmeasuredFunction => ({ path, name: name || '(anonymous)', start, end, reason: 'no-own-characters' })));
  const suite = origin.provenance.status === 'verified' ? origin.provenance.suite : origin.suite ?? 'unit';
  const report: CoverageReport = { version: 2, measurementVersion: 'own-characters-1', unmeasuredFunctions, ...origin, suite, processes, scripts: scripts.size, files };
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    fs.mkdirSync(dirname(file), { recursive: true });
    fs.writeFileSync(temporary, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
    fs.renameSync(temporary, file);
  } catch {
    fs.rmSync(temporary, { force: true });
    throw new CommandError(`Cannot write the report ${file}.`);
  }
  return report;
}

// Preserve the whole range while measuring only characters that the function owns.
function orderedFunctions({ functions }: MergedScript): MergedFunction[] {
  return [...functions.values()].sort((first, second) => first.start - second.start || second.end - first.end || first.name.localeCompare(second.name));
}

function fileCoverageOf(path: string, script: MergedScript): FileCoverage {
  return { path, representation: script.representation, contentIdentity: script.contentIdentity, functions: orderedFunctions(script).filter(({ ownCharacters }) => ownCharacters > 0).map(functionCoverageOf) };
}

function functionCoverageOf({ name, start, end, called, covered, ownCharacters }: MergedFunction): FunctionCoverage {
  const ran = covered.reduce((sum, value) => sum + value, 0);
  return { name: name || '(anonymous)', start, end, called, coveredShare: Math.round((ran / ownCharacters) * 1000) / 1000 };
}
