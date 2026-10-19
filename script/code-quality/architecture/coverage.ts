// The coverage report of script/code-quality/ast-metrics-coverage.ts, versions 1 and 2. The check covers the fields that the CRAP of a
// function reads, so that a wrong file, such as a snapshot, fails it.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { coverageProvenanceIn } from '../provenance/read.ts';
import type { CoverageProvenance } from '../provenance/types.ts';
import { arrayOf, jsonOf, numberOf, objectOf, textOf } from '../shared/json.ts';
import { CommandError } from '../shared/repository.ts';

// The name is the name that V8 gives the function: (anonymous) for a function without a name, and the name of the class
// for a constructor. The covered share is the part of the characters of the function that the unit suite ran.
export interface CoverageFunction {
  readonly name: string;
  readonly coveredShare: number;
}

// A src/ file that no unit test loaded is not in the report.
export interface CoverageReport {
  readonly commit?: string;
  readonly suite?: string;
  readonly measurementVersion?: string;
  readonly provenance?: CoverageProvenance;
  readonly files: readonly { readonly path: string; readonly functions: readonly CoverageFunction[] }[];
}

type Fields = ReturnType<typeof objectOf>;

// Gives the value of a field that a report always has, or stops the check.
type Check = <T>(value: T | undefined) => T;

// The coverage command writes its report there by default. A repository without the report gets no bands.
const defaultReport = join('ast-report', 'coverage.json');

export function coverageOfRepository(root: string, file: string | undefined): CoverageReport | undefined {
  if (file !== undefined) return coverageInFile(file);
  const report = join(root, defaultReport);
  return existsSync(report) ? coverageInFile(report) : undefined;
}

// The path is relative to the current folder, as the command line gives it.
export function coverageInFile(path: string): CoverageReport {
  const fields = objectOf(jsonOf(fileText(path)));
  if ((fields.version !== 1 && fields.version !== 2) || !Array.isArray(fields.files)) invalid(path);
  const check: Check = (value) => value ?? invalid(path);
  const unmeasured = unmeasuredNames(fields.unmeasuredFunctions, check);
  return { commit: textOf(fields.commit), suite: textOf(fields.suite), measurementVersion: textOf(fields.measurementVersion),
    provenance: coverageProvenanceIn(fields.provenance), files: arrayOf(fields.files).map((entry) => fileOf(objectOf(entry), check, unmeasured)) };
}

function fileText(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    throw new CommandError(`Cannot read the coverage file ${path}.`);
  }
}

function invalid(path: string): never {
  throw new CommandError(`The file ${path} is not a valid coverage report of version 1 or 2.`);
}

function fileOf(fields: Fields, check: Check, unmeasured: ReadonlySet<string>): CoverageReport['files'][number] {
  const functions = check(Array.isArray(fields.functions) ? arrayOf(fields.functions) : undefined);
  const path = check(textOf(fields.path));
  const measured = functions.map((entry) => functionOf(objectOf(entry), check)).filter(({ name }) => !unmeasured.has(JSON.stringify([path, name])));
  return { path, functions: measured };
}

function functionOf(fields: Fields, check: Check): CoverageFunction {
  return { name: check(textOf(fields.name)), coveredShare: check(numberOf(fields.coveredShare)) };
}

// The name join cannot distinguish a measured function from an unmeasured namesake.
function unmeasuredNames(value: unknown = [], check: Check): ReadonlySet<string> {
  const entries = check(Array.isArray(value) ? value : undefined);
  return new Set(entries.map((entry) => {
    const fields = objectOf(entry);
    check(fields.reason === 'no-own-characters' ? fields.reason : undefined);
    return JSON.stringify([check(textOf(fields.path)), check(textOf(fields.name))]);
  }));
}
