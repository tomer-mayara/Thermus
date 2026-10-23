export const normalizationVersion = 'typescript-tokens-v2';
type NormalizationVersion = 'typescript-tokens-v1' | typeof normalizationVersion;

export interface FunctionIdentity {
  readonly version: NormalizationVersion;
  readonly kind: string;
  readonly owner: string;
  readonly name: string;
  // Zero-based UTF-16 offsets: start is inclusive and end is exclusive.
  readonly start: number;
  readonly end: number;
  readonly body: string;
  readonly signature: string;
}

export interface SourceEvidence {
  readonly version: NormalizationVersion;
  readonly coordinates: 'utf16';
  readonly complete: boolean;
}
