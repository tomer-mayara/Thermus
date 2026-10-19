export type DependencyKind = 'static' | 'type' | 're-export' | 'side-effect' | 'dynamic';
export type DependencyIssueReason = 'unresolved-local' | 'non-literal-dynamic' | 'unsupported-alias' | 'parse-error' | 'outside-src';

export interface DependencyPair {
  readonly from: string;
  readonly to: string;
  readonly kinds: readonly DependencyKind[];
}

export interface DependencyIssue {
  readonly path: string;
  readonly specifier?: string;
  readonly reason: DependencyIssueReason;
}

export interface DependencyEvidence {
  readonly version: 1;
  readonly pairs: readonly DependencyPair[];
  readonly issues: readonly DependencyIssue[];
}
