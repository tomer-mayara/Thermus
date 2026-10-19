import { objectOf } from '../shared/json.ts';
import type { CoverageProvenance, InputIdentity } from './types.ts';

function isHash(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}
export function inputIdentityIn(value: unknown): InputIdentity | undefined {
  const record = objectOf(value);
  if (record.suite !== 'unit' || record.measurementVersion !== 'own-characters-1') return undefined;
  if (![record.sourceFingerprint, record.inputsFingerprint].every(isHash)) return undefined;
  if (![record.runtime, record.compiler].every((item) => typeof item === 'string' && item.length > 0)) return undefined;
  const { sourceFingerprint, inputsFingerprint, runtime, compiler, measurementVersion, suite } = record;
  return { sourceFingerprint, inputsFingerprint, runtime, compiler, measurementVersion, suite } as InputIdentity;
}
export function coverageProvenanceIn(value: unknown): CoverageProvenance | undefined {
  const record = objectOf(value);
  if (record.status === 'unverified' && typeof record.reason === 'string' && record.reason.length > 0) {
    return { status: 'unverified', reason: record.reason, ...('original' in record ? { original: record.original } : {}) };
  }
  const identity = inputIdentityIn(record);
  if (record.status !== 'verified' || identity === undefined) return undefined;
  if (typeof record.capturedCommit !== 'string' || !/^[a-f0-9]{40}$/.test(record.capturedCommit)) return undefined;
  if (![record.buildFingerprint, record.captureManifestFingerprint].every(isHash)) return undefined;
  return { ...identity, status: 'verified', capturedCommit: record.capturedCommit, buildFingerprint: record.buildFingerprint as string, captureManifestFingerprint: record.captureManifestFingerprint as string };
}
