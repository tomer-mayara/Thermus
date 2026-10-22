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

export interface CheckResult {
  readonly tier: Tier;
  readonly tierName: typeof tierNames[Tier];
  readonly eligibility: 'eligible' | 'blocked';
  readonly blockers: readonly Reason[];
  readonly candidate: string;
  readonly mergeBase: string;
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
  readonly notes: readonly string[];
  readonly label: string;
}
