// Assemble a snapshot from native measurements and their exact source text.
import { dependenciesOf } from '../dependencies/source.ts';
import { snapshotCommunitiesOf } from './communities.ts';
import { functionEvidenceOf } from '../identity/source.ts';
import { serverCommunitiesOf } from './input.ts';
import { nativeFunctionsOf } from '../identity/native.ts';
import { communityMapOf } from './map.ts';
import * as numbers from '../shared/numbers.ts';
import type { FileMeasurement, Snapshot, SnapshotFile } from './types.ts';
import type { ComponentDefinitions } from '../../component-ownership.ts';
import { CommandError } from '../shared/repository.ts';

export interface SnapshotSources {
  readonly root: string;
  readonly ownership?: ComponentDefinitions;
  readonly commit: string;
  readonly date: string;
  readonly title?: string;
  // Sorted by path, as sourceFilesOf gives them. The snapshot keeps this order.
  readonly files: readonly FileMeasurement[];
  // The answer texts of get_communities and of get_file_metrics for each file.
  readonly communities: string;
  readonly functions: ReadonlyMap<string, string>;
  readonly sourceTexts: ReadonlyMap<string, string>;
}

export function snapshotOf(sources: SnapshotSources): Snapshot {
  const answer = serverCommunitiesOf(sources.communities);
  const map = communityMapOf(answer);
  const files = sources.files
    .map((file) => snapshotFileOf(file, map.communityOf(file.path), sources))
    .map((file) => fileWithEvidence(file, sources.sourceTexts.get(file.path)));
  return {
    ...(sources.ownership === undefined ? {} : { ownership: sources.ownership }),
    version: 1,
    commit: sources.commit,
    date: sources.date,
    title: sources.title,
    global: {
      modularity: numbers.rounded(answer.modularity, 2),
      crossShare: numbers.rounded(answer.crossShare, 2),
      cycles: map.cycles,
      maintainability: numbers.weightedMaintainability(sources.files),
      paths: numbers.sumOf(sources.files.map((file) => file.paths)),
      files: files.length,
      functions: numbers.sumOf(files.map((file) => file.functions.length)),
    },
    communities: snapshotCommunitiesOf(map, sources.files),
    files,
    ...(sources.sourceTexts ? { dependencies: dependenciesOf(sources.sourceTexts, files.map((file) => file.path)) } : {}),
  };
}

// The averages of the communities and of src/ use the values of the report; the snapshot shows them rounded.
function snapshotFileOf(file: FileMeasurement, community: string | null, sources: SnapshotSources): SnapshotFile {
  const source = sources.sourceTexts.get(file.path);
  if (source === undefined) throw new CommandError(`Missing source text for ${file.path}. No snapshot was published.`);
  return {
    path: file.path,
    community,
    maintainability: numbers.rounded(file.maintainability, 1),
    maintainabilityRaw: file.maintainability,
    paths: file.paths,
    loc: file.loc,
    risk: numbers.rounded(file.risk, 2),
    functions: nativeFunctionsOf(sources.root, file.path, sources.functions.get(file.path), source),
  };
}

function fileWithEvidence(file: SnapshotFile, text: string | undefined): SnapshotFile {
  if (text === undefined) return file;
  return { ...file, ...functionEvidenceOf({ path: file.path, text }, file.functions) };
}
