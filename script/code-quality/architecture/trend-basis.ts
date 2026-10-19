import { objectOf } from '../shared/json.ts';
import type { VerifiedCoverageProvenance } from '../provenance/types.ts';
import type { FileCrap } from './crap.ts';

export interface TrendCrapBasis {
  readonly kind: 'head-derived-estimate' | 'measured';
  readonly coverageCommit: string;
  readonly sourceFingerprint: string;
  readonly inputsFingerprint: string;
  readonly buildFingerprint: string;
  readonly measurementVersion: 'own-characters-1';
  readonly unknownFunctions: number;
}

export interface TrendCoverage {
  readonly kind: TrendCrapBasis['kind'];
  readonly provenance: VerifiedCoverageProvenance;
}

export function trendBasisOf(coverage: TrendCoverage, files: ReadonlyMap<string, FileCrap>): TrendCrapBasis {
  const { capturedCommit, sourceFingerprint, inputsFingerprint, buildFingerprint, measurementVersion } = coverage.provenance;
  const unknownFunctions = [...files.values()].reduce((total, file) => total + file.unmatched, 0);
  return { kind: coverage.kind, coverageCommit: capturedCommit, sourceFingerprint, inputsFingerprint, buildFingerprint, measurementVersion, unknownFunctions };
}

export function trendBasisIn(value: unknown): TrendCrapBasis | undefined {
  const fields = objectOf(value);
  if (fields.kind !== 'head-derived-estimate' && fields.kind !== 'measured') return undefined;
  if (typeof fields.coverageCommit !== 'string' || !/^[a-f0-9]{40}$/u.test(fields.coverageCommit)) return undefined;
  if (!['sourceFingerprint', 'inputsFingerprint', 'buildFingerprint'].every((key) => validHash(fields[key]))) return undefined;
  if (fields.measurementVersion !== 'own-characters-1') return undefined;
  if (!Number.isSafeInteger(fields.unknownFunctions) || (fields.unknownFunctions as number) < 0) return undefined;
  return fields as unknown as TrendCrapBasis;
}

export function validHash(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
}
