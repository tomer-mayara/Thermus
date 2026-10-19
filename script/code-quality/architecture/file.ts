// The shape of a snapshot file follows version 1 of script/code-quality/snapshot/types.ts. The check covers the fields
// that the map, the complexity table, and the trend read, so that a wrong file, such as another report of ast-metrics,
// fails it.
import { readFileSync } from 'node:fs';
import { inputIdentityIn } from '../provenance/read.ts';
import { functionIdentityIn } from '../identity/read.ts';
import { metricMatchesIdentity } from '../identity/metric.ts';
import { sourceEvidenceIn } from '../identity/source-read.ts';
import * as json from '../shared/json.ts';
import type { MapSnapshot } from './types.ts';
import { CommandError } from '../shared/repository.ts';

type Fields = ReturnType<typeof json.objectOf>;
type MapCommunity = MapSnapshot['communities'][number];
type TableFile = MapSnapshot['files'][number];
type MapFunction = NonNullable<TableFile['functions']>[number];

// Gives the value of a field that a snapshot always has, or stops the check.
type Check = <T>(value: T | undefined) => T;

// The path is relative to the current folder, as the command line gives it.
export function snapshotInFile(path: string): MapSnapshot {
  const fields = json.objectOf(json.jsonOf(fileText(path)));
  if (fields.version !== 1 || !Array.isArray(fields.communities) || !Array.isArray(fields.files)) invalid(path);
  return snapshotOf(fields, (value) => value ?? invalid(path));
}

function fileText(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    throw new CommandError(`Cannot read the snapshot file ${path}.`);
  }
}

function invalid(path: string): never {
  throw new CommandError(`The file ${path} is not a valid snapshot of version 1.`);
}

// The maintainability is absent for a src/ without code, so it stays optional.
function snapshotOf(fields: Fields, check: Check): MapSnapshot {
  const global = json.objectOf(fields.global);
  return {
    commit: check(json.textOf(fields.commit)),
    date: check(json.isoDateOf(fields.date)),
    provenance: inputIdentityIn(fields.provenance),
    global: {
      modularity: check(json.numberOf(global.modularity)), crossShare: check(json.numberOf(global.crossShare)), cycles: json.arrayOf(global.cycles).map(json.textsOf),
      maintainability: json.numberOf(global.maintainability), paths: check(json.numberOf(global.paths)), files: check(json.numberOf(global.files)), functions: check(json.numberOf(global.functions)),
    },
    communities: json.arrayOf(fields.communities).map((entry) => communityOf(json.objectOf(entry), check)),
    files: json.arrayOf(fields.files).map((entry) => fileOf(json.objectOf(entry), check)),
  };
}

// The maintainability is absent for a community without code, so it stays optional.
function communityOf(fields: Fields, check: Check): MapCommunity {
  return {
    id: check(json.textOf(fields.id)),
    label: check(json.textOf(fields.label)),
    members: json.textsOf(fields.members),
    files: check(json.numberOf(fields.files)),
    loc: check(json.numberOf(fields.loc)),
    maintainability: json.numberOf(fields.maintainability),
    paths: check(json.numberOf(fields.paths)),
    edges: json.arrayOf(fields.edges).map((entry) => {
      const edge = json.objectOf(entry);
      return { to: check(json.textOf(edge.to)), references: check(json.numberOf(edge.references)), inCycle: edge.inCycle === true };
    }),
  };
}

// A value that ast-metrics did not measure is absent, so a file needs only its path. A file without functions, such as
// a file of types, has none to join with the coverage.
function fileOf(fields: Fields, check: Check): TableFile {
  const functions = json.arrayOf(fields.functions).map((entry) => functionOf(json.objectOf(entry), check));
  const sourceEvidence = sourceEvidenceIn(fields.sourceEvidence);
  if (!uniqueIdentityRanges(functions)) {
    throw new CommandError('The snapshot binds more than one metric to the same source range.');
  }
  if (sourceEvidence?.complete && (!Array.isArray(fields.functions) || !completeIdentities(functions))) {
    throw new CommandError('The snapshot claims complete source evidence for an unknown function.');
  }
  return { sourceEvidence, path: check(json.textOf(fields.path)), maintainability: json.numberOf(fields.maintainability), paths: json.numberOf(fields.paths), risk: json.numberOf(fields.risk), functions };
}

function functionOf(fields: Fields, check: Check): MapFunction {
  const name = check(json.textOf(fields.name));
  const identity = functionIdentityIn(fields.identity);
  if (identity && !metricMatchesIdentity(name, identity)) {
    throw new CommandError('The snapshot binds a metric name to an unrelated source identity.');
  }
  return { name, paths: check(json.numberOf(fields.paths)), identity };
}

function completeIdentities(functions: readonly MapFunction[]): boolean {
  const declarations = new Set<string>();
  const ranges = new Set<string>();
  for (const entry of functions) {
    if (!entry.identity) return false;
    const { kind, owner, name, start, end } = entry.identity;
    const declaration = JSON.stringify([kind, owner, name]);
    const range = JSON.stringify([start, end]);
    if (declarations.has(declaration) || ranges.has(range)) return false;
    declarations.add(declaration);
    ranges.add(range);
  }
  return true;
}

function uniqueIdentityRanges(functions: readonly MapFunction[]): boolean {
  const ranges = functions.flatMap((entry) => entry.identity ? [JSON.stringify([entry.identity.start, entry.identity.end])] : []);
  return new Set(ranges).size === ranges.length;
}
