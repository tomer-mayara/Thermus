// The covered share of each function of the two snapshots. The coverage report is of the head only: the base tree gets
// no coverage run, so a function of the base gets the share of the head
// (docs/implementation/architecture-evolution-plan.md, "CRAP per function").
import type { CoverageFunction } from './ast-metrics-architecture-coverage.ts';
import { fileCrapOf, type FileCrap, type ShareRule } from './ast-metrics-architecture-crap.ts';
import type { MapSources, TableFile } from './ast-metrics-architecture-types.ts';

// Each file of the head and of the base, by path.
interface SnapshotCrap {
  readonly head: ReadonlyMap<string, FileCrap>;
  readonly base: ReadonlyMap<string, FileCrap>;
}

export function snapshotCrapOf({ base, head, coverage }: MapSources): SnapshotCrap | undefined {
  if (coverage === undefined) return undefined;
  const covered = new Map(coverage.files.map((file) => [file.path, file.functions]));
  const headCrap = new Map(head.files.map((file) => [file.path, fileCrapOf(file, coverageShareOf(covered.get(file.path)))]));
  const headFiles = new Map(head.files.map((file) => [file.path, file]));
  const baseCrap = base.files.map((file): [string, FileCrap] => [file.path, fileCrapOf(file, headShareOf(headFiles.get(file.path), headCrap.get(file.path)))]);
  return { head: headCrap, base: new Map(baseCrap) };
}

// A file that the report does not have is uncovered: no unit test loaded it. A key that the report has twice or not at
// all names no single function of the report.
function coverageShareOf(covered: readonly CoverageFunction[] | undefined): ShareRule {
  return (_name, key) => {
    if (covered === undefined) return 0;
    const partners = covered.filter((entry) => entry.name === key);
    return partners.length === 1 ? partners[0].coveredShare : undefined;
  };
}

// A function of the base has the share of the function of the head with the same name, and 0 when the head file does
// not have the name, such as a function that the pull request removed. A function that the head has without a CRAP gets
// none in the base either, so that two equal trees give equal counts.
function headShareOf(file: TableFile | undefined, crap: FileCrap | undefined): ShareRule {
  return (name) => {
    const partner = crap?.functions.find((entry) => entry.name === name);
    if (partner !== undefined) return partner.share;
    return file?.functions?.some((entry) => entry.name === name) ? undefined : 0;
  };
}
