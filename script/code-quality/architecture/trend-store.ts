import { linkSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { textOrder } from './order.ts';
import { trendNumbersInFile } from './trend-file.ts';
import { withTrendLock } from './trend-lock.ts';
import type { TrendNumbers, TrendRecord } from './trend-record.ts';
import { CommandError } from '../shared/repository.ts';

const recordName = /^\d{4}-\d{2}-\d{2}-([0-9a-f]{8})\.json$/u;
interface StoredRecord { readonly name: string; readonly numbers: TrendNumbers }

// No base means read only. A writer scans and validates every record under one store lock.
export function trendOfStore(folder: string, base?: TrendRecord): TrendNumbers[] {
  if (base === undefined) return latestOf(storedRecordsIn(folder));
  return withTrendLock(folder, () => recordedTrend(folder, base));
}

function recordedTrend(folder: string, base: TrendRecord): TrendNumbers[] {
  const records = storedRecordsIn(folder);
  if (records.some(({ numbers }) => numbers.commit === base.commit)) return latestOf(records);
  if (records.some(({ numbers }) => numbers.commit.slice(0, 8) === base.commit.slice(0, 8))) {
    throw new CommandError(`The trend store has a commit prefix collision for ${base.commit.slice(0, 8)}.`);
  }
  return latestOf([...records, { name: writtenRecord(folder, base), numbers: base }]);
}

function latestOf(records: readonly StoredRecord[]): TrendNumbers[] {
  const timeOf = ({ numbers }: StoredRecord) => Date.parse(numbers.date);
  const sorted = [...records].sort((first, second) => timeOf(first) - timeOf(second) || textOrder(first.name, second.name));
  return sorted.slice(-10).map(({ numbers }) => numbers);
}

function storedRecordsIn(folder: string): StoredRecord[] {
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

// A hard link publishes the completed bytes without replacing an existing file.
function writtenRecord(folder: string, record: TrendRecord): string {
  const name = `${record.date.slice(0, 10)}-${record.commit.slice(0, 8)}.json`;
  const temporary = join(folder, `.record-${randomUUID()}.tmp`);
  try {
    writeFileSync(temporary, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' });
    linkSync(temporary, join(folder, name));
  } catch { throw new CommandError(`Cannot publish the trend file ${join(folder, name)} without overwrite.`); }
  finally { try { unlinkSync(temporary); } catch { /* No temporary file was created. */ } }
  return name;
}
