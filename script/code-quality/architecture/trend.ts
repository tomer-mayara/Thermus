import { join, resolve } from 'node:path';
import type { CrapDelta } from './crap-delta.ts';
import { trendSectionOf } from './trend-table.ts';
import { trendRecordOf } from './trend-record.ts';
import { trendOfStore } from './trend-store.ts';
import { canRecordBase } from './trend-verification.ts';
import type { MapSources } from './types.ts';
import { CommandError, repositoryRoot } from '../shared/repository.ts';

interface StoreChoice {
  readonly source: { readonly kind: 'files' | 'repository' };
  readonly trendStore: string | undefined;
  readonly record?: boolean;
}

export function trendLinesOf(choice: StoreChoice, sources: MapSources, delta: CrapDelta | undefined): string[] {
  const store = storeOf(choice);
  const records = recordsOf(sources, delta);
  const write = shouldRecord(choice, store, sources.base);
  if (store === undefined) return trendSectionOf(undefined, records.head);
  return trendSectionOf(trendOfStore(store, write ? records.base : undefined), records.head);
}

function recordsOf(sources: MapSources, delta: CrapDelta | undefined) {
  const provenance = sources.coverage?.provenance;
  const verified = provenance?.status === 'verified' ? provenance : undefined;
  return {
    base: trendRecordOf(sources.base, delta?.base, verified && { kind: 'head-derived-estimate', provenance: verified }),
    head: trendRecordOf(sources.head, delta?.head, verified && { kind: 'measured', provenance: verified }),
  };
}

function shouldRecord(choice: StoreChoice, store: string | undefined, base: MapSources['base']): boolean {
  if (!choice.record) return false;
  if (store === undefined) throw new CommandError('Cannot record without a trend store; use --trend-store.');
  if (canRecordBase(repositoryRoot(), base)) return true;
  process.stderr.write(`No record: ${base.commit.slice(0, 8)} is not on origin/main.\n`);
  return false;
}

function storeOf({ source, trendStore }: StoreChoice): string | undefined {
  if (trendStore !== undefined) return resolve(trendStore);
  return source.kind === 'repository' ? join(repositoryRoot(), 'docs', 'metrics') : undefined;
}
