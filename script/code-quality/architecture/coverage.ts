// Read measured function ranges without joining distinct declarations by their names.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { CoverageProvenance, CoverageSuite } from '../provenance/types.ts';
import type { FunctionIdentity } from '../identity/types.ts';
import { coverageInFile } from './coverage-reader.ts';

export interface CoverageFunction {
  readonly name: string;
  readonly coveredShare: number;
  readonly start?: number;
  readonly end?: number;
  readonly sourceIdentity?: FunctionIdentity;
  readonly identityRequired?: true;
}

// A source file absent from the report was not loaded by the selected suites.
export interface CoverageReport {
  readonly version?: number;
  readonly commit?: string;
  readonly suite?: CoverageSuite | readonly CoverageSuite[];
  readonly measurementVersion?: string;
  readonly provenance?: CoverageProvenance;
  readonly files: readonly {
    readonly path: string;
    readonly representation?: 'emitted-javascript' | 'source-typescript';
    readonly contentIdentity?: string;
    readonly sourceContentIdentity?: string;
    readonly functions: readonly CoverageFunction[];
  }[];
}

const defaultReport = join('ast-report', 'coverage.json');

export function coverageOfRepository(root: string | undefined, file: string | undefined): CoverageReport | undefined {
  if (file !== undefined) return coverageInFile(file);
  if (root === undefined) return undefined;
  const report = join(root, defaultReport);
  return existsSync(report) ? coverageInFile(report) : undefined;
}
