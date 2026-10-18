// The shape of the JSON report of "ast-metrics analyze" follows ast-metrics 0.43.1.
import { relative, sep } from 'node:path';
import { isJsonObject, jsonOf, numberOf, objectOf } from './ast-metrics-json.ts';
import { numberOrZero, textOf } from './ast-metrics-snapshot-json.ts';
import type { FileMeasurement } from './ast-metrics-snapshot-types.ts';
import { CommandError } from './repository.ts';

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
    .sort((first, second) => (first.path < second.path ? -1 : 1));
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
