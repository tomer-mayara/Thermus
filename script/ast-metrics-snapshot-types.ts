// The snapshot of one tree, as script/ast-metrics-snapshot.ts writes it to snapshot.json: the numbers of ast-metrics for
// the files under src/ and their communities. docs/implementation/architecture-evolution-plan.md ("The snapshot") gives
// its purpose; the later commands of the plan read it.
//
// A score keeps one decimal and a share two; a count is an integer. A field that ast-metrics did not measure is absent,
// such as the maintainability of a file of types. Communities are sorted by label and files by path, so that two
// snapshots diff well.

export interface Snapshot {
  readonly version: 1;
  // The commit of HEAD and its committer date (ISO 8601). The files can hold changes that are not committed.
  readonly commit: string;
  readonly date: string;
  readonly global: GlobalNumbers;
  readonly communities: readonly SnapshotCommunity[];
  readonly files: readonly SnapshotFile[];
}

interface GlobalNumbers {
  // From get_communities, for the dependency graph of src/.
  readonly modularity: number;
  readonly crossShare: number;
  // The labels of the communities in each cycle between src/ communities.
  readonly cycles: readonly (readonly string[])[];
  // The LOC-weighted maintainability, the decision paths, and the counts of the src/ files.
  readonly maintainability?: number;
  readonly paths: number;
  readonly files: number;
  readonly functions: number;
}

// A community of ast-metrics that has a member in src/. The id is the id of ast-metrics, which changes from analysis to
// analysis; the label names the community for a reader.
export interface SnapshotCommunity {
  readonly id: string;
  readonly label: string;
  readonly hub: string;
  // The src/ files of the community, with their extension.
  readonly members: readonly string[];
  readonly files: number;
  readonly loc: number;
  readonly maintainability?: number;
  readonly paths: number;
  readonly references: CommunityReferences;
  readonly edges: readonly SnapshotEdge[];
}

export interface CommunityReferences {
  readonly internal: number;
  readonly inbound: number;
  readonly outbound: number;
}

// A dependency on another src/ community, sorted by the label of that community.
export interface SnapshotEdge {
  readonly to: string;
  readonly references: number;
  readonly inCycle: boolean;
}

export interface SnapshotFile {
  readonly path: string;
  // null for a file that is in no community, such as an entry point that no file imports.
  readonly community: string | null;
  readonly maintainability?: number;
  readonly paths: number;
  readonly loc: number;
  readonly risk?: number;
  readonly functions: readonly SnapshotFunction[];
}

// A function in the order of get_file_metrics. ast-metrics gives no line numbers, and an anonymous function, such as a
// callback, has the name (anonymous).
export interface SnapshotFunction {
  readonly name: string;
  readonly paths: number;
  readonly maintainability?: number;
  readonly loc: number;
}

// One src/ file of the JSON report of ast-metrics analyze, with the values of the report before they are rounded.
export interface FileMeasurement {
  readonly path: string;
  readonly paths: number;
  readonly loc: number;
  readonly maintainability?: number;
  readonly risk?: number;
}
