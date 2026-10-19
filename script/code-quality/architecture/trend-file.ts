// Stored records can predate coverage provenance. Validate the complete record before selecting table values;
// keep a missing count basis absent so that the table can identify legacy unknown counts.
import { readFileSync } from 'node:fs';
import { jsonOf, objectOf } from '../shared/json.ts';
import type { TrendNumbers } from './trend-record.ts';
import { validTrendRecord } from './trend-validation.ts';
import { CommandError } from '../shared/repository.ts';

export function trendNumbersInFile(path: string): TrendNumbers {
  const fields = objectOf(jsonOf(fileText(path)));
  if (!validTrendRecord(fields)) throw new CommandError(`The file ${path} is not a valid trend file of version 1.`);
  const { tool, commit, date, modularity, crossShare, cycles, maintainability, functionsOver30 } = fields;
  return { commit, date, modularity, crossShare, cycles, maintainability, functionsOver30,
    ...(tool === undefined ? {} : { tool }),
    ...(fields.crap === undefined ? {} : { crap: fields.crap }),
  };
}

function fileText(path: string): string {
  try { return readFileSync(path, 'utf8'); }
  catch { throw new CommandError(`Cannot read the trend file ${path}.`); }
}
