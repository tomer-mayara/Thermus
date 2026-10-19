import { join } from 'node:path';
import { firstParentMainHistory } from '../architecture/main-history.ts';
import { storedTrendRecordsIn } from '../architecture/trend-history.ts';
import { trendRecordsOf } from '../architecture/trend-record.ts';
import { trendOfStore } from '../architecture/trend-store.ts';
import { recordBaseIfRequested } from '../architecture/trend-verification.ts';
import { cliToolVersion } from '../shared/tool-version.ts';
import { CommandError } from '../shared/repository.ts';
import { snapshotOfCommit } from '../snapshot/commit.ts';
import type { Notice } from '../snapshot/sweep.ts';

interface BackfillRun {
  readonly root: string;
  readonly count: number;
  readonly allowToolVersion: boolean;
  readonly notice: Notice;
}

export async function backfillMain(run: BackfillRun): Promise<string> {
  const history = firstParentMainHistory(run.root);
  if (history.kind === 'unavailable') throw new CommandError(`Cannot backfill: ${history.reason}`);
  const store = join(run.root, 'docs', 'metrics');
  const existing = new Set(storedTrendRecordsIn(store).map(({ numbers }) => numbers.commit));
  const selected = history.commits.slice(0, run.count).reverse();
  const missing = selected.filter((commit) => !existing.has(commit));
  if (missing.length === 0) return summary(0, selected.length);
  const checked = cliToolVersion(run.root, run.allowToolVersion);
  for (const commit of missing) {
    const snapshot = await snapshotOfCommit({ root: run.root, commit, timeoutMs: 60_000, notice: run.notice, toolVersion: checked });
    const record = trendRecordsOf({ base: snapshot, head: snapshot, touched: [] }, undefined).base;
    if (!recordBaseIfRequested(true, store, snapshot)) throw new CommandError(`Cannot backfill ${commit}: the commit is no longer on origin/main.`);
    trendOfStore(store, record);
  }
  return summary(missing.length, selected.length - missing.length);
}

function summary(written: number, kept: number): string {
  return `Backfill complete: ${written} records written; ${kept} existing records kept.\n`;
}
