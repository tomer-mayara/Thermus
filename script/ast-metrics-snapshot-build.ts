// The build is pure, so that its rules have unit tests without git and ast-metrics: ast-metrics-snapshot-tree.ts runs
// them and gives the answers.
import { serverCommunitiesOf } from './ast-metrics-snapshot-communities.ts';
import { snapshotCommunitiesOf } from './ast-metrics-snapshot-community.ts';
import { snapshotFunctionsOf } from './ast-metrics-snapshot-functions.ts';
import { communityMapOf } from './ast-metrics-snapshot-map.ts';
import { rounded, sumOf, weightedMaintainability } from './ast-metrics-snapshot-numbers.ts';
import type { FileMeasurement, Snapshot, SnapshotFile } from './ast-metrics-snapshot-types.ts';

export interface SnapshotSources {
  readonly commit: string;
  readonly date: string;
  // Sorted by path, as sourceFilesOf gives them. The snapshot keeps this order.
  readonly files: readonly FileMeasurement[];
  // The answer texts of get_communities and of get_file_metrics for each file.
  readonly communities: string;
  readonly functions: ReadonlyMap<string, string>;
}

export function snapshotOf(sources: SnapshotSources): Snapshot {
  const answer = serverCommunitiesOf(sources.communities);
  const map = communityMapOf(answer);
  const files = sources.files.map((file) => snapshotFileOf(file, map.communityOf(file.path), sources.functions.get(file.path)));
  return {
    version: 1,
    commit: sources.commit,
    date: sources.date,
    global: {
      modularity: rounded(answer.modularity, 2),
      crossShare: rounded(answer.crossShare, 2),
      cycles: map.cycles,
      maintainability: weightedMaintainability(sources.files),
      paths: sumOf(sources.files.map((file) => file.paths)),
      files: files.length,
      functions: sumOf(files.map((file) => file.functions.length)),
    },
    communities: snapshotCommunitiesOf(map, sources.files),
    files,
  };
}

// The averages of the communities and of src/ use the values of the report; the snapshot shows them rounded.
function snapshotFileOf(file: FileMeasurement, community: string | null, functions: string | undefined): SnapshotFile {
  return {
    path: file.path,
    community,
    maintainability: rounded(file.maintainability, 1),
    paths: file.paths,
    loc: file.loc,
    risk: rounded(file.risk, 2),
    functions: snapshotFunctionsOf(file.path, functions),
  };
}
