// The data of the architecture delta of docs/implementation/architecture-evolution-plan.md ("The views", views 1 and 2):
// two snapshots of src/, the map that compares them, and the files of the complexity table.
import type { Snapshot, SnapshotCommunity, SnapshotFile } from './ast-metrics-snapshot-types.ts';

// The parts of a snapshot that the map and the complexity table read. A snapshot of script/ast-metrics-snapshot.ts has
// all of them, and so has a snapshot file after its check.
export interface MapSnapshot {
  readonly commit: string;
  readonly global: Pick<Snapshot['global'], 'modularity' | 'crossShare' | 'cycles'>;
  readonly communities: readonly MapCommunity[];
  readonly files: readonly TableFile[];
}

export type MapCommunity = Pick<SnapshotCommunity, 'id' | 'label' | 'members' | 'files' | 'maintainability' | 'paths' | 'edges'>;

// A snapshot of script/ast-metrics-snapshot.ts gives each file its decision paths, but a snapshot file can leave them
// out: the table then says that they are not measured.
export type TableFile = Pick<SnapshotFile, 'path' | 'maintainability' | 'risk'> & Partial<Pick<SnapshotFile, 'paths'>>;

export interface MapSources {
  readonly base: MapSnapshot;
  readonly head: MapSnapshot;
  // The changed files of the pull request, as paths from the root, such as src/auth/session.ts.
  readonly touched: readonly string[];
}

// kept: a head community with a match in the base, or a dependency that both snapshots have between matched
// communities. new: only in the head. gone: only in the base.
type Status = 'kept' | 'new' | 'gone';

export interface CommunityNumbers {
  readonly files: number;
  readonly maintainability?: number;
  readonly paths: number;
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
