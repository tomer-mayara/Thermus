import { readFileSync } from 'node:fs';
import { isoDateOf, jsonOf, objectOf, textOf, type JsonObject } from '../shared/json.ts';
import type { TrendNumbers } from './trend-record.ts';
import { countIn, finiteNumber, validStructure } from './trend-validation.ts';
import { trendBasisIn, validHash } from './trend-basis.ts';
import { CommandError } from '../shared/repository.ts';

type Check = <T>(value: T | undefined) => T;

export function trendNumbersInFile(path: string): TrendNumbers {
  const fields = objectOf(jsonOf(fileText(path)));
  const check: Check = (value) => value ?? invalid(path);
  const commit = check(textOf(fields.commit));
  if (fields.version !== 1 || !/^[a-f0-9]{40}$/u.test(commit) || !validStructure(fields)) invalid(path);
  validateOptional(fields, path);
  return {
    commit, date: check(isoDateOf(fields.date)),
    modularity: check(finiteNumber(fields.modularity)), crossShare: check(finiteNumber(fields.crossShare)),
    cycles: check(countIn(fields.cycles)), maintainability: finiteNumber(fields.maintainability),
    functionsOver30: countIn(fields.functionsOver30),
    ...(fields.crap === undefined ? {} : { crap: check(trendBasisIn(fields.crap)) }),
  };
}

function validateOptional(fields: JsonObject, path: string): void {
  if (fields.maintainability !== undefined && finiteNumber(fields.maintainability) === undefined) invalid(path);
  if (fields.functionsOver30 !== undefined && countIn(fields.functionsOver30) === undefined) invalid(path);
  if (fields.sourceFingerprint !== undefined && !validHash(fields.sourceFingerprint)) invalid(path);
  if (fields.crap !== undefined && (fields.functionsOver30 === undefined || trendBasisIn(fields.crap) === undefined)) invalid(path);
}

function fileText(path: string): string {
  try { return readFileSync(path, 'utf8'); }
  catch { throw new CommandError(`Cannot read the trend file ${path}.`); }
}

function invalid(path: string): never {
  throw new CommandError(`The file ${path} is not a valid trend file of version 1.`);
}
