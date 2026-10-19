// The data of the architecture delta of docs/implementation/architecture-evolution-plan.md ("The views"): two snapshots
// of src/, the map that compares them, and the files of the complexity table.
import type { DependencyEvidence } from '../dependencies/types.ts';
import type { FileChange } from '../delta/changes.ts';
import type { InputIdentity } from '../provenance/types.ts';
import type { CoverageReport } from './coverage.ts';
import type { Snapshot, SnapshotCommunity, SnapshotFile, SnapshotFunction } from '../snapshot/types.ts';

// The parts of a snapshot that the map, the complexity table, and the trend read. A snapshot of
// script/code-quality/ast-metrics-snapshot.ts has all of them, and so has a snapshot file after its check. The trend keeps the global
// numbers and the numbers of each community, and the date of the commit names its record.
export interface MapSnapshot {
  readonly tool?: string;
  readonly commit: string;
  readonly date: string;
  readonly title?: string;
  readonly provenance?: InputIdentity;
  readonly dependencies?: DependencyEvidence;
  readonly global: Snapshot['global'];
  readonly communities: readonly MapCommunity[];
  readonly files: readonly TableFile[];
}

export type MapCommunity = Pick<SnapshotCommunity, 'id' | 'label' | 'members' | 'files' | 'loc' | 'maintainability' | 'paths' | 'edges'>;

// A snapshot of script/code-quality/ast-metrics-snapshot.ts gives each file its decision paths and its functions, but a snapshot file
// can leave them out: the table then says that they are not measured.
export type TableFile = Pick<SnapshotFile, 'path' | 'maintainability' | 'risk' | 'sourceEvidence'> & Partial<Pick<SnapshotFile, 'paths' | 'loc'>> & {
  readonly functions?: readonly MapFunction[];
};

export type MapFunction = Pick<SnapshotFunction, 'name' | 'paths' | 'identity'>;

export interface MapSources {
  readonly base: MapSnapshot;
  readonly head: MapSnapshot;
  // The changed files of the pull request, as paths from the root, such as src/auth/session.ts.
  readonly touched: readonly string[];
  readonly changes?: readonly FileChange[];
  // Actual repository inputs, or changed paths declared with offline snapshots.
  readonly testChangesOnly?: boolean;
  // The coverage of the unit suite in the head. Without it, the report has no bands.
  readonly coverage?: CoverageReport;
  readonly coverageNotice?: string;
}

// The band of docs/implementation/architecture-evolution-plan.md ("Bands"). A function at CRAP 30 or more is over.
export type Band = 'good' | 'warning' | 'critical';

export interface NodeBand {
  readonly band?: Band;
  // An unknown covered share prevents a complete assessment.
  readonly unknown?: number;
  readonly unmeasuredFiles?: number;
  // The functions that are over: in the head, or in the base for a gone community.
  readonly count: number;
  // Head minus base, and the band of the base, for a kept community.
  readonly change?: number;
  readonly before?: Band;
}

// kept: a head community with a match in the base, or a dependency that both snapshots have between matched
// communities. new: only in the head. gone: only in the base.
type Status = 'kept' | 'new' | 'gone';

export interface CommunityNumbers {
  readonly files: number;
  readonly maintainability?: number;
  readonly paths?: number;
}

export interface MapNode {
  readonly label: string;
  readonly status: Status;
  // A changed file is one of the members of the community: of the head community, or of the base one when it is gone.
  readonly touched: boolean;
  // The head numbers, or the base numbers of a gone community.
  readonly numbers: CommunityNumbers;
  // Head minus base, for a kept community. The maintainability change is absent when one side has no maintainability.
  readonly change?: CommunityNumbers;
  // Absent without coverage.
  readonly band?: NodeBand;
}

export interface MapEdge {
  readonly from: MapNode;
  readonly to: MapNode;
  readonly status: Status;
  // The head references, or the base references of a gone dependency. The change is head minus base, and 0 for a new or
  // a gone dependency.
  readonly references: number;
  readonly change: number;
  // A gone dependency is in no cycle of the head.
  readonly inCycle: boolean;
}

// The nodes are sorted by label and the edges by the labels of their ends, so that the Mermaid text diffs well. On a
// tie, the head comes first.
export interface ArchitectureMap {
  readonly nodes: readonly MapNode[];
  readonly edges: readonly MapEdge[];
  // A community is new, gone, or touched, or a dependency or a cycle between communities appeared or disappeared.
  readonly changed: boolean;
}
