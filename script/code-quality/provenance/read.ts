import { captureSetFingerprintOf } from './captures.ts';
import { objectOf, type JsonObject } from '../shared/json.ts';
import type { CoverageProvenance, CoverageSuite, InputIdentity, VerifiedCoverageProvenance } from './types.ts';

function isHash(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}
export function inputIdentityIn(value: unknown): InputIdentity | undefined {
  const record = objectOf(value);
  if (typeof record.suite !== 'string' || !['unit', 'integration', 'acceptance'].includes(record.suite) || record.measurementVersion !== 'own-characters-1') return undefined;
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
  return Array.isArray(record.suite) ? combinedCaptureIn(record) : singleCaptureIn(record);
}

type CaptureMetadata = Pick<VerifiedCoverageProvenance, 'status' | 'capturedCommit' | 'buildFingerprint' | 'captureManifestFingerprint'>;
function captureMetadataIn(record: JsonObject): CaptureMetadata | undefined {
  if (record.status !== 'verified' || typeof record.capturedCommit !== 'string' || !/^[a-f0-9]{40}$/.test(record.capturedCommit)) return undefined;
  if (!isHash(record.buildFingerprint) || !isHash(record.captureManifestFingerprint)) return undefined;
  return { status: 'verified', capturedCommit: record.capturedCommit, buildFingerprint: record.buildFingerprint, captureManifestFingerprint: record.captureManifestFingerprint };
}
function singleCaptureIn(record: JsonObject): VerifiedCoverageProvenance | undefined {
  const identity = inputIdentityIn(record);
  const metadata = captureMetadataIn(record);
  if (identity === undefined || metadata === undefined || record.captures !== undefined) return undefined;
  const comparison = comparisonEvidenceIn(record.comparisonIdentity, identity);
  return comparison === undefined ? undefined : { ...identity, ...metadata, ...comparison };
}
function comparisonEvidenceIn(value: unknown, identity: InputIdentity): Pick<VerifiedCoverageProvenance, 'comparisonIdentity'> | undefined {
  if (value === undefined) return {};
  const comparisonIdentity = inputIdentityIn(value);
  if (comparisonIdentity?.suite !== 'unit') return undefined;
  if (!(['sourceFingerprint', 'runtime', 'compiler', 'measurementVersion'] as const).every((key) => identity[key] === comparisonIdentity[key])) return undefined;
  if (identity.suite === 'unit' && identity.inputsFingerprint !== comparisonIdentity.inputsFingerprint) return undefined;
  return { comparisonIdentity };
}
function combinedCaptureIn(record: JsonObject): VerifiedCoverageProvenance | undefined {
  const suites = coverageSuitesIn(record.suite);
  const comparisonIdentity = inputIdentityIn(record.comparisonIdentity);
  const envelope = singleCaptureIn({ ...record, suite: 'unit', captures: undefined });
  const captures = capturesIn(record.captures);
  if (suites === undefined || comparisonIdentity === undefined || envelope === undefined || captures === undefined) return undefined;
  const provenance = { ...envelope, suite: suites, comparisonIdentity, captures };
  return compatibleCaptureSet(provenance) ? provenance : undefined;
}
function capturesIn(value: unknown): readonly VerifiedCoverageProvenance[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const captures: VerifiedCoverageProvenance[] = [];
  for (const item of value) {
    const capture = singleCaptureIn(objectOf(item));
    if (capture === undefined) return undefined;
    captures.push(capture);
  }
  return captures;
}
function compatibleCaptureSet(provenance: VerifiedCoverageProvenance & { captures: readonly VerifiedCoverageProvenance[] }): boolean {
  const { captures } = provenance;
  if (JSON.stringify(captures.map(({ suite }) => suite)) !== JSON.stringify(provenance.suite)) return false;
  if (provenance.captureManifestFingerprint !== captureSetFingerprintOf(captures)) return false;
  return captures.every((capture) => sameCaptureBasis(provenance, capture));
}
function sameCaptureBasis(top: VerifiedCoverageProvenance, capture: VerifiedCoverageProvenance): boolean {
  return JSON.stringify(capture.comparisonIdentity) === JSON.stringify(top.comparisonIdentity)
    && (['capturedCommit', 'sourceFingerprint', 'runtime', 'compiler', 'buildFingerprint', 'measurementVersion'] as const).every((key) => top[key] === capture[key]);
}
export function coverageSuitesIn(value: unknown): readonly CoverageSuite[] | undefined {
  const suites = typeof value === 'string' ? [value] : value;
  if (!Array.isArray(suites) || suites.length === 0 || suites.some((suite) => !['unit', 'integration', 'acceptance'].includes(suite)) || new Set(suites).size !== suites.length) return undefined;
  return suites;
}
