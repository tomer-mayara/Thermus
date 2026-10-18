// The coverage report of script/code-quality/ast-metrics-coverage.ts, version 1. The check covers the fields that the CRAP of a
// function reads, so that a wrong file, such as a snapshot, fails it.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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
  if (fields.version !== 1 || !Array.isArray(fields.files)) invalid(path);
  const check: Check = (value) => value ?? invalid(path);
  return { files: arrayOf(fields.files).map((entry) => fileOf(objectOf(entry), check)) };
}

function fileText(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    throw new CommandError(`Cannot read the coverage file ${path}.`);
  }
}

function invalid(path: string): never {
  throw new CommandError(`The file ${path} is not a valid coverage report of version 1.`);
}

function fileOf(fields: Fields, check: Check): CoverageReport['files'][number] {
  const functions = check(Array.isArray(fields.functions) ? arrayOf(fields.functions) : undefined);
  return { path: check(textOf(fields.path)), functions: functions.map((entry) => functionOf(objectOf(entry), check)) };
}

function functionOf(fields: Fields, check: Check): CoverageFunction {
  return { name: check(textOf(fields.name)), coveredShare: check(numberOf(fields.coveredShare)) };
}
