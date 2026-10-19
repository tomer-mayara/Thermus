import { join, resolve } from 'node:path';
import type { CrapDelta } from './crap-delta.ts';
import { trendSectionOf } from './trend-table.ts';
import { trendRecordsOf } from './trend-record.ts';
import { firstParentMainHistory } from './main-history.ts';
import { storedTrendRecordsIn } from './trend-history.ts';
import { trendGapLinesOf } from './trend-gaps.ts';
import { trendOfStore } from './trend-store.ts';
import { recordBaseIfRequested } from './trend-verification.ts';
import type { MapSources } from './types.ts';
import { repositoryRoot } from '../shared/repository.ts';

interface StoreChoice {
  readonly source: { readonly kind: 'files' | 'repository' };
  readonly trendStore: string | undefined;
  readonly record?: boolean;
}

// A failed recording check must print no Markdown and leave history unchanged.
// Check eligibility before the store opens or the section renders.
export function trendLinesOf(choice: StoreChoice, sources: MapSources, delta: CrapDelta | undefined): string[] {
  const store = storeOf(choice);
  const records = trendRecordsOf(sources, delta);
  const write = recordBaseIfRequested(choice.record, store, sources.base);
  if (store === undefined) return trendSectionOf(undefined, records.head);
  const displayed = trendOfStore(store, write ? records.base : undefined);
  const stored = storedTrendRecordsIn(store).map(({ numbers }) => numbers);
  const history = choice.source.kind === 'repository' ? firstParentMainHistory(repositoryRoot()) : undefined;
  const gaps = trendGapLinesOf(history, displayed, stored);
  return [...trendSectionOf(displayed, records.head), ...(gaps.length === 0 ? [] : ['', ...gaps])];
}

// Two snapshot files can render outside a repository, with no Git available.
// Such a report gets a store only from an explicit --trend-store path.
function storeOf({ source, trendStore }: StoreChoice): string | undefined {
  if (trendStore !== undefined) return resolve(trendStore);
  return source.kind === 'repository' ? join(repositoryRoot(), 'docs', 'metrics') : undefined;
}
