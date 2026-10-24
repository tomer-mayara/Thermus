import type { SignalOutcome } from './rules.ts';
import type { Reason } from './types.ts';

// The rule of each outcome: the earlier key, which is T1 Team review, and the note key of the rules of 2026-10-24.
export interface SignalKeys {
  readonly T1: string;
  readonly note: string;
}

export interface SignalOutcomes {
  readonly reasons: Reason[];
  readonly notes: string[];
}

// A quality signal informs the author under the rules of 2026-10-24, and calls a team member under the earlier rules.
export function signalsOf(outcome: SignalOutcome, keys: SignalKeys, facts: readonly string[]): SignalOutcomes {
  if (outcome === 'note') return { reasons: [], notes: facts.map((fact) => `${keys.note}: ${fact}`) };
  return { reasons: facts.map((fact) => ({ tier: 'T1', key: keys.T1, fact })), notes: [] };
}
