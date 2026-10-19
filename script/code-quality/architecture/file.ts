// The shape of a snapshot file follows version 1 of script/code-quality/snapshot/types.ts. The check covers the fields
// that the map, the complexity table, and the trend read, so that a wrong file, such as another report of ast-metrics,
// fails it.
import { dependenciesIn } from '../dependencies/read.ts';
import { jsonFieldsInFile } from '../shared/json-file.ts';
import { inputIdentityIn } from '../provenance/read.ts';
import { identityForMetric } from '../identity/metric.ts';
import { fileEvidenceIn } from '../identity/file.ts';
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
  const fields = jsonFieldsInFile(path, 'snapshot');
  if (fields.version !== 1 || !Array.isArray(fields.communities) || !Array.isArray(fields.files)) invalid(path);
  return snapshotOf(fields, (value) => value ?? invalid(path));
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
    tool: fields.tool === undefined ? undefined : check(json.textOf(fields.tool)?.trim() || undefined),
    provenance: inputIdentityIn(fields.provenance),
    global: {
      modularity: check(json.numberOf(global.modularity)), crossShare: check(json.numberOf(global.crossShare)), cycles: json.arrayOf(global.cycles).map(json.textsOf),
      maintainability: json.numberOf(global.maintainability), paths: check(json.numberOf(global.paths)), files: check(json.numberOf(global.files)), functions: check(json.numberOf(global.functions)),
    },
    communities: json.arrayOf(fields.communities).map((entry) => communityOf(json.objectOf(entry), check)),
    files: json.arrayOf(fields.files).map((entry) => fileOf(json.objectOf(entry), check)),
    dependencies: dependenciesIn(fields.dependencies, json.arrayOf(fields.files).map((entry) => check(json.textOf(json.objectOf(entry).path)))),
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
  const sourceEvidence = fileEvidenceIn(fields.sourceEvidence, Array.isArray(fields.functions) ? functions : undefined);
  return { sourceEvidence, path: check(json.textOf(fields.path)), maintainability: json.numberOf(fields.maintainability), paths: json.numberOf(fields.paths), loc: json.numberOf(fields.loc), risk: json.numberOf(fields.risk), functions };
}

function functionOf(fields: Fields, check: Check): MapFunction {
  const name = check(json.textOf(fields.name));
  const identity = identityForMetric(name, fields.identity);
  return { name, paths: check(json.numberOf(fields.paths)), identity };
}
