import { latestTrendOf, storedTrendRecordsIn } from './trend-history.ts';
import * as fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { withTrendLock } from './trend-lock.ts';
import type { TrendNumbers, TrendRecord } from './trend-record.ts';
import { CommandError } from '../shared/repository.ts';

// No base means read only. The lock must cover both validation and publication, or concurrent writers
// could publish different dates for one commit.
export function trendOfStore(folder: string, base?: TrendRecord): TrendNumbers[] {
  if (base === undefined) return latestTrendOf(storedTrendRecordsIn(folder));
  return withTrendLock(folder, () => recordedTrend(folder, base));
}

function recordedTrend(folder: string, base: TrendRecord): TrendNumbers[] {
  const records = storedTrendRecordsIn(folder);
  // A stored estimate belongs to its first recording pull request, even when newer coverage gives other values.
  if (records.some(({ numbers }) => numbers.commit === base.commit)) return latestTrendOf(records);
  if (records.some(({ numbers }) => numbers.commit.slice(0, 8) === base.commit.slice(0, 8))) {
    throw new CommandError(`The trend store has a commit prefix collision for ${base.commit.slice(0, 8)}.`);
  }
  return latestTrendOf([...records, { name: publishTrendRecord(folder, base), numbers: base }]);
}

// A hard link publishes the completed bytes without replacing an existing file.
function publishTrendRecord(folder: string, record: TrendRecord): string {
  const name = `${record.date.slice(0, 10)}-${record.commit.slice(0, 8)}.json`;
  const temporary = join(folder, `.record-${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' });
    fs.linkSync(temporary, join(folder, name));
  } catch { throw new CommandError(`Cannot publish the trend file ${join(folder, name)} without overwrite.`); }
  // Cleanup must not hide a publication failure. Only the temporary link is removed;
  // the completed record has its own link and must stay untouched.
  finally { try { fs.unlinkSync(temporary); } catch { /* Keep the publication result. */ } }
  return name;
}
