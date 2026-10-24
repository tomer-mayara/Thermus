export type Tier = 'T0' | 'T1' | 'T2';
export const tiers: readonly Tier[] = ['T2', 'T1', 'T0'];
export const tierNames = { T0: 'T0 Auto merge', T1: 'T1 Team review', T2: 'T2 Need architect' } as const;

export interface Reason {
  readonly tier?: Exclude<Tier, 'T0'>;
  readonly blocking?: true;
  readonly key: string;
  readonly fact: string;
}

export interface Question {
  readonly key: string;
  readonly question: string;
}

export interface Change {
  readonly status: string;
  readonly oldPath?: string;
  readonly path: string;
}

// The entry of the rules file that would list a fact.
export interface Declaration {
  readonly key: string;
  readonly value: string;
}

// A dependency fact of the candidate. key is the trigger of the rules file. source names a file that causes the fact.
export interface Fact {
  readonly key: string;
  readonly text: string;
  readonly declare?: Declaration;
  readonly source?: string;
}

// A fact that the check establishes from the rules and the files of both revisions. detail is the full diff of a
// changed declaration snapshot.
export interface ArchitectureFact {
  readonly key: string;
  readonly fact: string;
  readonly detail?: string;
}

// The facts of one key, with the tier of the key. summary is the phrase of the key for the summary line. notes inform
// the author and select no tier; blockers stop the merge.
export interface FactGroup {
  readonly tier: 'T1' | 'T2';
  readonly facts: readonly ArchitectureFact[];
  readonly summary: string;
  readonly notes?: readonly string[];
  readonly blockers?: readonly Reason[];
}

// policy is facts when the rules of the merge base have the section architecture, and earlier when they do not.
// summary is one line: the tier that the facts select, and what they are.
export interface ArchitectureResult {
  readonly policy: 'facts' | 'earlier';
  readonly facts: readonly ArchitectureFact[];
  readonly summary: string;
}

export interface CheckResult {
  readonly tier: Tier;
  readonly tierName: typeof tierNames[Tier];
  readonly eligibility: 'eligible' | 'blocked';
  readonly blockers: readonly Reason[];
  readonly candidate: string;
  readonly mergeBase: string;
  readonly architecture: ArchitectureResult;
  readonly reasons: readonly Reason[];
  readonly questions: readonly Question[];
  readonly changedPaths: readonly Change[];
  readonly lineCounts: { readonly production: number; readonly productionLimit: number; readonly total: number; readonly totalLimit: number };
  readonly tests: { readonly added: number; readonly removed: number; readonly skippedOrTodo: readonly string[] };
  readonly mi: readonly string[];
  readonly crap: readonly string[];
  readonly metrics: readonly string[];
  readonly factsToDeclare: readonly Declaration[];
  readonly declaredFacts: readonly Declaration[];
  readonly surfaceDifferences: readonly string[];
  // Signals that inform the author and select no tier, such as a size above the note limit.
  readonly informational: readonly string[];
  readonly notes: readonly string[];
  readonly label: string;
}

// The flags of .pr-impact.json that select a tier, in the order of the earlier rules: the first five were
// T2 Need architect, the other five T1 Team review. The rules of 2026-10-24 list them under impact. uncertain is
// separate: it is T1 Team review and blocked.
export const impactFlags = ['container', 'external', 'contract', 'deployment', 'crossCutting', 'component', 'internalInterface', 'sensitiveBehavior', 'dependencyRisk', 'policy'] as const;
export type ImpactFlag = typeof impactFlags[number];
