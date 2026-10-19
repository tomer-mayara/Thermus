import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { textOrder } from './order.ts';
import { trendNumbersInFile } from './trend-file.ts';
import type { TrendNumbers } from './trend-record.ts';
import { CommandError } from '../shared/repository.ts';

const recordName = /^\d{4}-\d{2}-\d{2}-([0-9a-f]{8})\.json$/u;
interface StoredRecord { readonly name: string; readonly numbers: TrendNumbers }

export function latestTrendOf(records: readonly StoredRecord[]): TrendNumbers[] {
  const timeOf = ({ numbers }: StoredRecord) => Date.parse(numbers.date);
  const sorted = [...records].sort((first, second) => timeOf(first) - timeOf(second) || textOrder(first.name, second.name));
  return sorted.slice(-10).map(({ numbers }) => numbers);
}

export function storedTrendRecordsIn(folder: string): StoredRecord[] {
  const records = recordNamesIn(folder).map((name) => ({ name, numbers: trendNumbersInFile(join(folder, name)) }));
  const prefixes = new Set<string>();
  for (const { name, numbers } of records) {
    const prefix = recordName.exec(name)?.[1];
    if (prefix !== numbers.commit.slice(0, 8) || !name.startsWith(numbers.date.slice(0, 10)) || prefixes.has(prefix)) throw new CommandError(`The trend store has a commit prefix collision or duplicate record in ${name}.`);
    prefixes.add(prefix);
  }
  return records;
}

function recordNamesIn(folder: string): string[] {
  try {
    const entries = readdirSync(folder, { withFileTypes: true }).filter((entry) => recordName.test(entry.name));
    if (entries.some((entry) => !entry.isFile())) throw new CommandError(`The trend store ${folder} has a record path that is not a regular file.`);
    return entries.map((entry) => entry.name);
  } catch (error) {
    if (error instanceof CommandError) throw error;
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw new CommandError(`Cannot read the trend store ${folder}.`);
  }
}
