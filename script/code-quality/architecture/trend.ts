// The trend section of the architecture command, after the complexity table: the record of the merge base goes to the
// trend store, and the table shows the last records of the store and the head
// (docs/implementation/architecture-evolution-plan.md, "The views", view 3).
import { join, resolve } from 'node:path';
import type { CrapDelta } from './crap-delta.ts';
import { trendSectionOf } from './report.ts';
import { trendRecordOf } from './trend-record.ts';
import { trendOfStore } from './trend-store.ts';
import type { MapSources } from './types.ts';
import { repositoryRoot } from '../shared/repository.ts';

// The parts of the command line that choose the store. trendStore is the --trend-store value, relative to the current
// folder.
interface StoreChoice {
  readonly source: { readonly kind: 'files' | 'repository' };
  readonly trendStore: string | undefined;
}

// The store of a repository is committed with the pull request, in this folder of the root.
const storeOfRoot = join('docs', 'metrics');

// The write goes before the output, so that a failed write fails the command and prints no Markdown. The counts of the
// functions at CRAP 30 or more are those of the summary line.
export function trendLinesOf(choice: StoreChoice, sources: MapSources, delta: CrapDelta | undefined): string[] {
  const store = storeOf(choice);
  const stored = store === undefined ? undefined : trendOfStore(store, trendRecordOf(sources.base, delta?.base));
  return trendSectionOf(stored, trendRecordOf(sources.head, delta?.head));
}

// Two snapshot files need no repository, so they get a store only from --trend-store.
function storeOf({ source, trendStore }: StoreChoice): string | undefined {
  if (trendStore !== undefined) return resolve(trendStore);
  return source.kind === 'repository' ? join(repositoryRoot(), storeOfRoot) : undefined;
}
