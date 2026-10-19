// Stored records can predate coverage provenance. Validate the complete record before selecting table values;
// keep a missing count basis absent so that the table can identify legacy unknown counts.
import { jsonFieldsInFile } from '../shared/json-file.ts';
import type { TrendNumbers } from './trend-record.ts';
import { validTrendRecord } from './trend-validation.ts';
import { CommandError } from '../shared/repository.ts';

export function trendNumbersInFile(path: string): TrendNumbers {
  const fields = jsonFieldsInFile(path, 'trend');
  if (!validTrendRecord(fields)) throw new CommandError(`The file ${path} is not a valid trend file of version 1.`);
  const { tool, commit, date, modularity, crossShare, cycles, maintainability, functionsOver30 } = fields;
  return { commit, date, modularity, crossShare, cycles, maintainability, functionsOver30,
    ...(tool === undefined ? {} : { tool }),
    ...(fields.title === undefined ? {} : { title: fields.title }),
    ...(fields.components === undefined ? {} : { components: fields.components }),
    ...(fields.crap === undefined ? {} : { crap: fields.crap }),
  };
}
