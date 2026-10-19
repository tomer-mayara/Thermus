// The record of one snapshot in the trend store of docs/implementation/architecture-evolution-plan.md ("The views", view
// 3): the global numbers of the snapshot and the numbers of each community, and nothing for each file, so that a record
// stays small and its numbers stay comparable from commit to commit. The record is pure, so that its rules have unit
// tests without git and ast-metrics.
import * as componentRecord from './component-record.ts';
import * as riskCounts from './risk-counts.ts';
import type { FileCrap } from './crap.ts';
import { trendBasisOf, type TrendCoverage, type TrendCrapBasis } from './trend-basis.ts';
import { textOrder } from '../shared/order.ts';
import type { CrapDelta } from './crap-delta.ts';
import type { MapSources, MapCommunity, MapSnapshot } from './types.ts';

// functionsOver30 is the count of the functions at CRAP 30 or more, absent without coverage.
interface TrendCommunity {
  readonly label: string;
  readonly files: number;
  readonly loc: number;
  readonly maintainability?: number;
  readonly paths: number;
  readonly functionsOver30?: number;
}

// The fields of the file come in this order, so that the files of two commits diff well. A value that the snapshot does
// not have is absent. cycles is the count of the cycles between communities.
export interface TrendRecord {
  readonly version: 1;
  readonly tool?: string;
  readonly commit: string;
  readonly date: string;
  readonly title?: string;
  readonly modularity: number;
  readonly crossShare: number;
  readonly cycles: number;
  readonly maintainability?: number;
  readonly paths: number;
  readonly files: number;
  readonly functions: number;
  readonly functionsOver30?: number;
  readonly communities: readonly TrendCommunity[];
  readonly components?: readonly componentRecord.TrendComponent[];
  readonly sourceFingerprint?: string;
  readonly crap?: TrendCrapBasis;
}

// The numbers of one row of the trend table.
export type TrendNumbers = Pick<TrendRecord, 'commit' | 'date' | 'title' | 'tool' | 'modularity' | 'crossShare' | 'cycles' | 'maintainability' | 'functionsOver30' | 'crap' | 'components'>;

// The CRAP of each file of the snapshot, by path, as the CRAP delta gives it.
type FilesCrap = ReadonlyMap<string, FileCrap>;

// Without coverage, crap is undefined and the record has no count of the functions at CRAP 30 or more.
function trendRecordOf(snapshot: MapSnapshot, crap: FilesCrap | undefined, coverage?: TrendCoverage): TrendRecord {
  const { modularity, crossShare, cycles, maintainability, paths, files, functions } = snapshot.global;
  const assessed = coverage === undefined ? undefined : crap;
  const communities = [...snapshot.communities].sort((first, second) => textOrder(first.label, second.label));
  return {
    version: 1, tool: snapshot.tool, commit: snapshot.commit, date: snapshot.date, title: snapshot.title,
    modularity, crossShare, cycles: cycles.length, maintainability, paths, files, functions, functionsOver30: assessed && riskCounts.totalCountOf(assessed),
    communities: communities.map((community) => trendCommunityOf(community, assessed)),
    components: componentRecord.componentRecordsOf(snapshot, assessed, coverage),
    sourceFingerprint: snapshot.provenance?.sourceFingerprint,
    crap: assessed && coverage && trendBasisOf(coverage, assessed),
  };
}

function trendCommunityOf(community: MapCommunity, crap: FilesCrap | undefined): TrendCommunity {
  const { label, files, loc, maintainability, paths } = community;
  return { label, files, loc, maintainability, paths, functionsOver30: crap && riskCounts.countOf(riskCounts.memberFunctionsOf(crap, community)) };
}

export function trendRecordsOf(sources: MapSources, delta: CrapDelta | undefined) {
  const provenance = sources.coverage?.provenance;
  const verified = provenance?.status === 'verified' ? provenance : undefined;
  return {
    base: trendRecordOf(sources.base, delta?.base, verified && { kind: 'head-derived-estimate', provenance: verified }),
    head: trendRecordOf(sources.head, delta?.head, verified && { kind: 'measured', provenance: verified }),
  };
}
