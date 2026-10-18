// CRAP (Change Risk Anti-Patterns, Savoia and Evans 2007) of each src/ function, as
// docs/implementation/architecture-evolution-plan.md ("CRAP per function") gives it: paths² × (1 − share)³ + paths,
// with the covered share of the function's own code in the unit suite. The base uses the share of the head,
// because the command runs the unit suite only for the head.
import type { CoverageFunction } from './coverage.ts';
import type { MapSources, TableFile } from './types.ts';
import { rounded } from '../shared/numbers.ts';

// A function at this CRAP or above is over the limit.
export const crapLimit = 30;

export interface FunctionCrap {
  readonly name: string;
  readonly paths: number;
  readonly share: number;
  // With one decimal, as the output gives it, so that the limit applies to the value that a reader sees.
  readonly crap: number;
}

// The functions of a file that have a CRAP, and the count of the functions that have none.
export interface FileCrap {
  readonly functions: readonly FunctionCrap[];
  readonly unmatched: number;
}

// Gives the share of a function from its name and its key, or undefined when the function has no CRAP.
type ShareRule = (name: string, key: string) => number | undefined;

export function isOver({ crap }: FunctionCrap): boolean {
  return crap >= crapLimit;
}

// A key that the file has twice names no single function, so neither function gets a CRAP.
function fileCrapOf(file: TableFile, shareOf: ShareRule): FileCrap {
  const functions = file.functions ?? [];
  const keys = functions.map(({ name }) => keyOf(name));
  const crap = functions.flatMap(({ name, paths }, index): FunctionCrap[] => {
    const key = keys[index];
    const share = key !== undefined && keys.indexOf(key) === keys.lastIndexOf(key) ? shareOf(name, key) : undefined;
    return share === undefined ? [] : [{ name, paths, share, crap: rounded(paths ** 2 * (1 - share) ** 3 + paths, 1) }];
  });
  return { functions: crap, unmatched: functions.length - crap.length };
}

// The key is the name that V8 gives the function. ast-metrics names a method module\Class.method, and V8 names it method,
// and a constructor Class. A method without a name, such as a function in a class field, is anonymous. An anonymous
// function has no key.
function keyOf(name: string): string | undefined {
  const method = /^[^\\]*\\([^.]*)\.(.*)$/u.exec(name);
  if (method === null) return name === '(anonymous)' ? undefined : name;
  const [, owner, member] = method;
  if (member === 'constructor') return owner;
  return member === '' ? undefined : member;
}

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
