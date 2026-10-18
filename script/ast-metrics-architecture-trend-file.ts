// A file of the trend store, version 1, as script/ast-metrics-architecture-trend-store.ts writes it. The check covers
// the fields that the trend table reads, so that a wrong file, such as a snapshot, fails it.
import { readFileSync } from 'node:fs';
import { jsonOf, numberOf, objectOf } from './ast-metrics-json.ts';
import { textOf } from './ast-metrics-snapshot-json.ts';
import type { TrendNumbers } from './ast-metrics-architecture-trend-record.ts';
import { CommandError } from './repository.ts';

// Gives the value of a field that a record always has, or stops the check.
type Check = <T>(value: T | undefined) => T;

// The path names the file in the diagnostic. A value that the record does not have, such as the count of the functions
// at CRAP 30 or more without coverage, stays absent.
export function trendNumbersInFile(path: string): TrendNumbers {
  const fields = objectOf(jsonOf(fileText(path)));
  if (fields.version !== 1) invalid(path);
  const check: Check = (value) => value ?? invalid(path);
  return {
    commit: check(textOf(fields.commit)),
    date: check(isoDateOf(fields.date)),
    modularity: check(numberOf(fields.modularity)),
    crossShare: check(numberOf(fields.crossShare)),
    cycles: check(numberOf(fields.cycles)),
    maintainability: numberOf(fields.maintainability),
    functionsOver30: numberOf(fields.functionsOver30),
  };
}

// A date and a time of ISO 8601, as git gives the committer date (%cI). The trend sorts its records by this time, and
// the day of the date in the time zone of the commit names the record.
export function isoDateOf(value: unknown): string | undefined {
  const text = textOf(value);
  if (text === undefined || !/^\d{4}-\d{2}-\d{2}T/u.test(text) || Number.isNaN(Date.parse(text))) return undefined;
  return text;
}

function fileText(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    throw new CommandError(`Cannot read the trend file ${path}.`);
  }
}

function invalid(path: string): never {
  throw new CommandError(`The file ${path} is not a valid trend file of version 1.`);
}
