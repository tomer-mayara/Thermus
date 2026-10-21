export type ReviewTier = 'T0' | 'T1' | 'T2';

export interface Assessment {
  readonly candidate: string;
  readonly mergeBase: string;
  readonly tier: ReviewTier;
  readonly eligibility: 'eligible' | 'blocked';
  readonly blockers: readonly { readonly key: string; readonly fact: string }[];
}

export interface Review {
  readonly login: string;
  readonly type: string;
  readonly state: string;
  readonly head: string;
  readonly submittedAt: string;
}

export interface MergeEvidence {
  readonly enabled: boolean;
  readonly head: string;
  readonly base: string;
  readonly paths: readonly string[];
  readonly author: string;
  readonly draft: boolean;
  readonly state: string;
  readonly mergeable: boolean;
  readonly held: boolean;
  readonly defaultBranch: boolean;
  readonly assessment: Assessment;
  readonly validation: { readonly trusted: boolean; readonly passed: boolean };
  readonly checks: readonly { readonly name: string; readonly status: string; readonly conclusion: string | null }[];
  readonly reviews: readonly Review[];
  readonly team: readonly string[];
  readonly architects: readonly string[];
  readonly reviewAfter?: string;
  readonly externalBlockers?: readonly string[];
}

export interface MergeDecision {
  readonly tierName: string;
  readonly eligibility: 'eligible' | 'blocked';
  readonly blockers: readonly string[];
}

export interface MergePort {
  inspect(): Promise<MergeEvidence>;
  merge(expectedHead: string): Promise<void>;
}
