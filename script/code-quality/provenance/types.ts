export type InputIdentity = {
  readonly sourceFingerprint: string;
  readonly inputsFingerprint: string;
  readonly runtime: string;
  readonly compiler: string;
  readonly measurementVersion: 'own-characters-1';
  readonly suite: 'unit';
};
export type VerifiedCoverageProvenance = InputIdentity & {
  readonly status: 'verified';
  readonly capturedCommit: string;
  readonly buildFingerprint: string;
  readonly captureManifestFingerprint: string;
};
type UnverifiedCoverageProvenance = {
  readonly status: 'unverified'; readonly reason: string; readonly original?: unknown;
};
export type CoverageProvenance = VerifiedCoverageProvenance | UnverifiedCoverageProvenance;
