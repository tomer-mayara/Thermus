// The trend store of docs/implementation/architecture-evolution-plan.md ("The views", view 3): a folder with one record
// file for each commit of main that a pull request used as its base. Nobody runs anything at merge time, so each pull
// request writes the record of its own base, and the trend lags one pull request behind main.
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { textOrder } from './order.ts';
import { trendNumbersInFile } from './trend-file.ts';
import type { TrendNumbers, TrendRecord } from './trend-record.ts';
import { CommandError } from '../shared/repository.ts';

// The name of a record file: the day of the date of the commit, in the time zone of the commit, and the first eight
// characters of the commit. A file with another name, such as a README, is no record.
const recordName = /^\d{4}-\d{2}-\d{2}-([0-9a-f]{8})\.json$/u;
const shownRecords = 10;

interface StoredRecord {
  readonly name: string;
  readonly numbers: TrendNumbers;
}

// Gives the last records of the store after the record of the base went to it. The store keeps the file of a commit
// under any date: a later pull request with the same base keeps it, also when its numbers differ, such as a count from
// another coverage run. The store reads its files first, so that a store with a wrong file gets no new file.
export function trendOfStore(folder: string, base: TrendRecord): TrendNumbers[] {
  const records = storedRecordsIn(folder);
  const commit = base.commit.slice(0, 8);
  if (records.some(({ name }) => recordName.exec(name)?.[1] === commit)) return latestOf(records);
  return latestOf([...records, { name: writtenRecord(folder, base), numbers: base }]);
}

// The last ten records by the time of their dates, oldest first. Two records of the same time come in the order of their
// file names.
function latestOf(records: readonly StoredRecord[]): TrendNumbers[] {
  const timeOf = ({ numbers }: StoredRecord) => Date.parse(numbers.date);
  const sorted = [...records].sort((first, second) => timeOf(first) - timeOf(second) || textOrder(first.name, second.name));
  return sorted.slice(-shownRecords).map(({ numbers }) => numbers);
}

function storedRecordsIn(folder: string): StoredRecord[] {
  return recordNamesIn(folder).map((name) => ({ name, numbers: trendNumbersInFile(join(folder, name)) }));
}

// A folder that does not exist holds no record. Nor does a path that is not a folder: the write then fails and names
// the file that it could not write.
function recordNamesIn(folder: string): string[] {
  try {
    return readdirSync(folder, { withFileTypes: true }).filter((entry) => entry.isFile() && recordName.test(entry.name)).map((entry) => entry.name);
  } catch (error) {
    if (['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) return [];
    throw new CommandError(`Cannot read the trend store ${folder}.`);
  }
}

// JSON with two spaces and a newline at the end, so that the files of two commits diff well.
function writtenRecord(folder: string, record: TrendRecord): string {
  const name = `${record.date.slice(0, 10)}-${record.commit.slice(0, 8)}.json`;
  try {
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, name), `${JSON.stringify(record, null, 2)}\n`);
  } catch {
    throw new CommandError(`Cannot write the trend file ${join(folder, name)}.`);
  }
  return name;
}
