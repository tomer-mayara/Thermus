// A file of the trend store, version 1, as script/code-quality/architecture/trend-store.ts writes it. The check covers
// the fields that the trend table reads, so that a wrong file, such as a snapshot, fails it.
import { readFileSync } from 'node:fs';
import { isoDateOf, jsonOf, numberOf, objectOf, textOf } from '../shared/json.ts';
import type { TrendNumbers } from './trend-record.ts';
import { CommandError } from '../shared/repository.ts';

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
