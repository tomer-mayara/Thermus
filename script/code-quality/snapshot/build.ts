// The build is pure, so that its rules have unit tests without git and ast-metrics: tree.ts runs
// them and gives the answers.
import { snapshotCommunitiesOf } from './communities.ts';
import { functionEvidenceOf } from '../identity/source.ts';
import { serverCommunitiesOf, snapshotFunctionsOf } from './input.ts';
import { communityMapOf } from './map.ts';
import { rounded, sumOf, weightedMaintainability } from '../shared/numbers.ts';
import type { FileMeasurement, Snapshot, SnapshotFile } from './types.ts';

export interface SnapshotSources {
  readonly commit: string;
  readonly date: string;
  // Sorted by path, as sourceFilesOf gives them. The snapshot keeps this order.
  readonly files: readonly FileMeasurement[];
  // The answer texts of get_communities and of get_file_metrics for each file.
  readonly communities: string;
  readonly functions: ReadonlyMap<string, string>;
  readonly sourceTexts?: ReadonlyMap<string, string>;
}

export function snapshotOf(sources: SnapshotSources): Snapshot {
  const answer = serverCommunitiesOf(sources.communities);
  const map = communityMapOf(answer);
  const files = sources.files
    .map((file) => snapshotFileOf(file, map.communityOf(file.path), sources.functions.get(file.path)))
    .map((file) => fileWithEvidence(file, sources.sourceTexts?.get(file.path)));
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

function fileWithEvidence(file: SnapshotFile, text: string | undefined): SnapshotFile {
  if (text === undefined) return file;
  return { ...file, ...functionEvidenceOf({ path: file.path, text }, file.functions) };
}
