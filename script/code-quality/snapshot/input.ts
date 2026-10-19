// The shape of the JSON report of "ast-metrics analyze" follows ast-metrics 0.43.1.
import { relative, sep } from 'node:path';
import { arrayOf, isJsonObject, jsonOf, numberOf, numberOrZero, objectOf, textOf, textsOf } from '../shared/json.ts';
import { textOrder } from '../shared/order.ts';
import { rounded } from '../shared/numbers.ts';
import type { CommunityReferences, FileMeasurement, SnapshotFunction } from './types.ts';
import { CommandError } from '../shared/repository.ts';

// Sorted by path, the order of the snapshot. The report names each file by its absolute path; the snapshot names it by
// its path from the root, with forward slashes.
export function sourceFilesOf(text: string, root: string): FileMeasurement[] {
  const report = jsonOf(text);
  if (!isJsonObject(report) || !Array.isArray(report.concernedFiles)) {
    throw new CommandError('ast-metrics analyze wrote a JSON report without a list of files.');
  }
  return report.concernedFiles
    .flatMap((entry) => measurementOf(entry, root))
    .filter((file) => file.path.startsWith('src/'))
    .sort((first, second) => textOrder(first.path, second.path));
}

// An entry without a path names no file. The report leaves out the maintainability index of a file without code, such
// as a file of types, and the risk score of many files, so both stay optional.
function measurementOf(entry: unknown, root: string): FileMeasurement[] {
  const fields = objectOf(entry);
  const path = textOf(fields.path);
  if (path === undefined) return [];
  return [{
    path: relative(root, path).split(sep).join('/'),
    paths: numberOrZero(objectOf(fields.complexity).cyclomatic),
    loc: numberOrZero(objectOf(fields.volume).loc),
    maintainability: numberOf(objectOf(fields.maintainability).maintainabilityIndex),
    risk: numberOf(objectOf(fields.risk).score),
  }];
}

// The shape of the answer of get_file_metrics follows ast-metrics 0.43.1.
// Each src/ file needs its answer: a snapshot with a gap would look complete.
export function snapshotFunctionsOf(path: string, text: string | undefined): SnapshotFunction[] {
  if (text === undefined) throw new CommandError(`get_file_metrics gave no answer for ${path}.`);
  const answer = jsonOf(text);
  if (!isJsonObject(answer)) throw new CommandError(`get_file_metrics gave an unexpected answer for ${path}: expected a JSON object.`);
  return arrayOf(answer.functions).map(functionOf);
}

// ast-metrics gives an anonymous function, such as a callback or a test case, an empty name. A function without code
// of its own has no maintainability index.
function functionOf(entry: unknown): SnapshotFunction {
  const fields = objectOf(entry);
  return {
    name: textOf(fields.name) || '(anonymous)',
    paths: numberOrZero(fields.cyclomatic_complexity),
    maintainability: rounded(numberOf(objectOf(fields.maintainability).maintainability_index), 1),
    loc: numberOrZero(objectOf(fields.volume).loc),
  };
}

// The shape of the answer of get_communities with members follows ast-metrics 0.43.1.
export interface ServerCommunities {
  readonly modularity: number;
  readonly crossShare: number;
  // The ids of the communities in each cycle.
  readonly cycles: readonly (readonly string[])[];
  readonly communities: readonly ServerCommunity[];
  readonly edges: readonly ServerEdge[];
}

// The shared kernel has the id "shared". A member is a unit of the dependency graph: a file without its extension, or a
// folder whose files ast-metrics groups into one unit.
export interface ServerCommunity {
  readonly id: string;
  readonly hubs: readonly string[];
  readonly members: readonly string[];
  readonly namespaces: readonly Namespace[];
  readonly references: CommunityReferences;
}

export interface Namespace {
  readonly namespace: string;
  readonly count: number;
}

export interface ServerEdge {
  readonly from: string;
  readonly to: string;
  readonly references: number;
  readonly inCycle: boolean;
}

// ast-metrics leaves out each value of zero, so the parse accepts a missing value, and an entry that is not an object
// gives no values.
export function serverCommunitiesOf(text: string): ServerCommunities {
  const answer = jsonOf(text);
  if (!isJsonObject(answer)) throw new CommandError('get_communities gave an unexpected answer: expected a JSON object.');
  return {
    modularity: numberOrZero(answer.modularity),
    crossShare: numberOrZero(answer.crossShare),
    cycles: arrayOf(answer.cycles).map(textsOf),
    communities: arrayOf(answer.communities).map(communityOf),
    edges: arrayOf(answer.edges).map(edgeOf),
  };
}

function communityOf(entry: unknown): ServerCommunity {
  const fields = objectOf(entry);
  return {
    id: textOf(fields.id) ?? '',
    hubs: textsOf(fields.hubs),
    members: textsOf(fields.members),
    namespaces: arrayOf(fields.namespaces).map(namespaceOf),
    references: { internal: numberOrZero(fields.internalReferences), inbound: numberOrZero(fields.inboundReferences), outbound: numberOrZero(fields.outboundReferences) },
  };
}

function namespaceOf(entry: unknown): Namespace {
  const fields = objectOf(entry);
  return { namespace: textOf(fields.namespace) ?? '', count: numberOrZero(fields.count) };
}

function edgeOf(entry: unknown): ServerEdge {
  const fields = objectOf(entry);
  return { from: textOf(fields.from) ?? '', to: textOf(fields.to) ?? '', references: numberOrZero(fields.references), inCycle: fields.inCycle === true };
}
