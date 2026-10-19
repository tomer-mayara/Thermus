import { createHash } from 'node:crypto';
import type { InputIdentity, VerifiedCoverageProvenance } from './types.ts';

export function captureSetFingerprintOf(captures: readonly VerifiedCoverageProvenance[]): string {
  return createHash('sha256').update(JSON.stringify(captures.map(({ suite, captureManifestFingerprint }) => ({ suite, captureManifestFingerprint })))).digest('hex');
}
export function coverageOriginOf(captures: readonly VerifiedCoverageProvenance[], comparisonIdentity: InputIdentity): VerifiedCoverageProvenance {
  const [first] = captures;
  if (captures.length === 1 && first.suite === 'unit') return first;
  return { ...comparisonIdentity, suite: captures.map(({ suite }) => suite as InputIdentity['suite']), comparisonIdentity,
    status: 'verified', capturedCommit: first.capturedCommit, buildFingerprint: first.buildFingerprint,
    captureManifestFingerprint: captureSetFingerprintOf(captures), captures };
}
