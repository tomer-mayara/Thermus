import type { DependencyEvidence } from '../dependencies/types.ts';
import type { FileChange } from '../delta/changes.ts';
import type { InputIdentity } from '../provenance/types.ts';
import type { CoverageReport } from './coverage.ts';
import type { Snapshot, SnapshotCommunity, SnapshotFile, SnapshotFunction } from '../snapshot/types.ts';
import type { ComponentDefinitions } from '../../component-ownership.ts';

export interface MapSnapshot {
  readonly ownership?: ComponentDefinitions;
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
  readonly touched: readonly string[];
  readonly changes?: readonly FileChange[];
  readonly testChangesOnly?: boolean;
  // The coverage of the unit suite in the head. Without it, the report has no bands.
  readonly coverage?: CoverageReport;
  readonly coverageNotice?: string;
}

export type Band = 'good' | 'warning' | 'critical';

export interface NodeBand {
  readonly band?: Band;
  // An unknown covered share prevents a complete assessment.
  readonly unknown?: number;
  readonly unmeasuredFiles?: number;
  readonly count: number;
  readonly change?: number;
  readonly before?: Band;
}

type Status = 'kept' | 'new' | 'gone';

export interface CommunityNumbers {
  readonly files: number;
  readonly maintainability?: number;
  readonly paths?: number;
}

export interface MapNode {
  readonly label: string;
  readonly status: Status;
  readonly touched: boolean;
  readonly numbers: CommunityNumbers;
  readonly change?: CommunityNumbers;
  readonly band?: NodeBand;
}

export interface MapEdge {
  readonly from: MapNode;
  readonly to: MapNode;
  readonly status: Status;
  readonly references: number;
  readonly change: number;
  readonly inCycle: boolean;
}

// The nodes are sorted by label and the edges by the labels of their ends, so that the Mermaid text diffs well. On a
// tie, the head comes first.
export interface ArchitectureMap {
  readonly nodes: readonly MapNode[];
  readonly edges: readonly MapEdge[];
  readonly changed: boolean;
}
