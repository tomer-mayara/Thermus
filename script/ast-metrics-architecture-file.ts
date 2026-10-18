// The shape of a snapshot file follows version 1 of script/ast-metrics-snapshot-types.ts. The check covers the fields
// that the map and the complexity table read, so that a wrong file, such as another report of ast-metrics, fails it.
import { readFileSync } from 'node:fs';
import { jsonOf, numberOf, objectOf } from './ast-metrics-json.ts';
import { arrayOf, textOf, textsOf } from './ast-metrics-snapshot-json.ts';
import type { MapFunction, MapSnapshot } from './ast-metrics-architecture-types.ts';
import { CommandError } from './repository.ts';

type Fields = ReturnType<typeof objectOf>;
type MapCommunity = MapSnapshot['communities'][number];
type TableFile = MapSnapshot['files'][number];

// Gives the value of a field that a snapshot always has, or stops the check.
type Check = <T>(value: T | undefined) => T;

// The path is relative to the current folder, as the command line gives it.
export function snapshotInFile(path: string): MapSnapshot {
  const fields = objectOf(jsonOf(fileText(path)));
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

function snapshotOf(fields: Fields, check: Check): MapSnapshot {
  const global = objectOf(fields.global);
  return {
    commit: check(textOf(fields.commit)),
    global: { modularity: check(numberOf(global.modularity)), crossShare: check(numberOf(global.crossShare)), cycles: arrayOf(global.cycles).map(textsOf) },
    communities: arrayOf(fields.communities).map((entry) => communityOf(objectOf(entry), check)),
    files: arrayOf(fields.files).map((entry) => fileOf(objectOf(entry), check)),
  };
}

// The maintainability is absent for a community without code, so it stays optional.
function communityOf(fields: Fields, check: Check): MapCommunity {
  return {
    id: check(textOf(fields.id)),
    label: check(textOf(fields.label)),
    members: textsOf(fields.members),
    files: check(numberOf(fields.files)),
    maintainability: numberOf(fields.maintainability),
    paths: check(numberOf(fields.paths)),
    edges: arrayOf(fields.edges).map((entry) => {
      const edge = objectOf(entry);
      return { to: check(textOf(edge.to)), references: check(numberOf(edge.references)), inCycle: edge.inCycle === true };
    }),
  };
}

// A value that ast-metrics did not measure is absent, so a file needs only its path. A file without functions, such as
// a file of types, has none to join with the coverage.
function fileOf(fields: Fields, check: Check): TableFile {
  const functions = arrayOf(fields.functions).map((entry) => functionOf(objectOf(entry), check));
  return { path: check(textOf(fields.path)), maintainability: numberOf(fields.maintainability), paths: numberOf(fields.paths), risk: numberOf(fields.risk), functions };
}

function functionOf(fields: Fields, check: Check): MapFunction {
  return { name: check(textOf(fields.name)), paths: check(numberOf(fields.paths)) };
}
