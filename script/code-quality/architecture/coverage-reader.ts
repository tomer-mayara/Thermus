import { jsonFieldsInFile } from '../shared/json-file.ts';
import { coverageProvenanceIn, coverageSuitesIn } from '../provenance/read.ts';
import * as json from '../shared/json.ts';
import { CommandError } from '../shared/repository.ts';
import type { CoverageReport } from './coverage.ts';
import { coverageFileIn, requiredArray, unmeasuredFunctions, type Check } from './coverage-format.ts';

const supportedVersions = new Set<unknown>([1, 2, 3]);

export function coverageInFile(path: string): CoverageReport {
  const fields = jsonFieldsInFile(path, 'coverage');
  if (!supportedVersions.has(fields.version)) invalid(path);
  const check: Check = (value) => value ?? invalid(path);
  if (fields.suite !== undefined && coverageSuitesIn(fields.suite) === undefined) invalid(path);
  const entries = requiredArray(fields.files, check);
  const version = fields.version as number;
  const unmeasured = unmeasuredFunctions(fields.unmeasuredFunctions, check, version);
  return {
    version, commit: json.textOf(fields.commit), suite: fields.suite as CoverageReport['suite'], measurementVersion: json.textOf(fields.measurementVersion),
    provenance: coverageProvenanceIn(fields.provenance), files: entries.map((entry) => coverageFileIn(json.objectOf(entry), check, unmeasured, version)),
  };
}

function invalid(path: string): never {
  throw new CommandError(`The file ${path} is not a valid coverage report of version 1, 2, or 3.`);
}
