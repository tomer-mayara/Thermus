export type CoverageSuite = 'unit' | 'integration' | 'acceptance';
export type InputIdentity = {
  readonly sourceFingerprint: string;
  readonly inputsFingerprint: string;
  readonly runtime: string;
  readonly compiler: string;
  readonly measurementVersion: 'own-characters-1';
  readonly suite: CoverageSuite;
};
export type VerifiedCoverageProvenance = Omit<InputIdentity, 'suite'> & {
  readonly suite: CoverageSuite | readonly CoverageSuite[];
  readonly status: 'verified';
  readonly capturedCommit: string;
  readonly buildFingerprint: string;
  readonly captureManifestFingerprint: string;
  readonly completionProtocol?: 'normal-exit-or-sealed-1';
  readonly captureId?: string;
  readonly comparisonIdentity?: InputIdentity;
  readonly captures?: readonly VerifiedCoverageProvenance[];
};
type UnverifiedCoverageProvenance = {
  readonly status: 'unverified'; readonly reason: string; readonly original?: unknown;
};
export type CoverageProvenance = VerifiedCoverageProvenance | UnverifiedCoverageProvenance;
