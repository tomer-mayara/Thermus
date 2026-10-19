// The coverage report of script/code-quality/ast-metrics-coverage.ts, versions 1 and 2. The check covers the fields that the CRAP of a
// function reads, so that a wrong file, such as a snapshot, fails it.
import { jsonFieldsInFile } from '../shared/json-file.ts';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { coverageProvenanceIn } from '../provenance/read.ts';
import type { CoverageProvenance } from '../provenance/types.ts';
import * as json from '../shared/json.ts';
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

type Fields = ReturnType<typeof json.objectOf>;

// Gives the value of a field that a report always has, or stops the check.
type Check = <T>(value: T | undefined) => T;

// The coverage command writes its report there by default. A repository without the report gets no bands.
const defaultReport = join('ast-report', 'coverage.json');
const supportedVersions = new Set<unknown>([1, 2]);

export function coverageOfRepository(root: string | undefined, file: string | undefined): CoverageReport | undefined {
  if (file !== undefined) return coverageInFile(file);
  if (root === undefined) return undefined;
  const report = join(root, defaultReport);
  return existsSync(report) ? coverageInFile(report) : undefined;
}

// The path is relative to the current folder, as the command line gives it.
function coverageInFile(path: string): CoverageReport {
  const fields = jsonFieldsInFile(path, 'coverage');
  if (!supportedVersions.has(fields.version)) invalid(path);
  const check: Check = (value) => value ?? invalid(path);
  const entries = requiredArray(fields.files, check);
  const unmeasured = unmeasuredNames(fields.unmeasuredFunctions, check);
  return {
    commit: json.textOf(fields.commit), suite: json.textOf(fields.suite), measurementVersion: json.textOf(fields.measurementVersion),
    provenance: coverageProvenanceIn(fields.provenance), files: entries.map((entry) => fileOf(json.objectOf(entry), check, unmeasured)),
  };
}

function invalid(path: string): never {
  throw new CommandError(`The file ${path} is not a valid coverage report of version 1 or 2.`);
}

function fileOf(fields: Fields, check: Check, unmeasured: ReadonlySet<string>): CoverageReport['files'][number] {
  const functions = requiredArray(fields.functions, check);
  const path = check(json.textOf(fields.path));
  const measured = functions.map((entry) => functionOf(json.objectOf(entry), check)).filter(({ name }) => !unmeasured.has(JSON.stringify([path, name])));
  return { path, functions: measured };
}

function functionOf(fields: Fields, check: Check): CoverageFunction {
  return { name: check(json.textOf(fields.name)), coveredShare: check(json.numberOf(fields.coveredShare)) };
}

// The name join cannot distinguish a measured function from an unmeasured namesake.
function unmeasuredNames(value: unknown = [], check: Check): ReadonlySet<string> {
  const entries = requiredArray(value, check);
  return new Set(entries.map((entry) => {
    const fields = json.objectOf(entry);
    check(fields.reason === 'no-own-characters' ? fields.reason : undefined);
    return JSON.stringify([check(json.textOf(fields.path)), check(json.textOf(fields.name))]);
  }));
}

function requiredArray(value: unknown, check: Check): readonly unknown[] {
  return check(Array.isArray(value) ? value : undefined);
}
