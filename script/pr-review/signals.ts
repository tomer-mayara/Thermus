import type { SignalOutcome } from './rules.ts';
import type { Reason } from './types.ts';

export interface SignalKeys {
  readonly T1: string;
  readonly note: string;
}

export interface SignalOutcomes {
  readonly reasons: Reason[];
  readonly notes: string[];
}

export function signalsOf(outcome: SignalOutcome, keys: SignalKeys, facts: readonly string[]): SignalOutcomes {
  if (outcome === 'note') return { reasons: [], notes: facts.map((fact) => `${keys.note}: ${fact}`) };
  return { reasons: facts.map((fact) => ({ tier: 'T1', key: keys.T1, fact })), notes: [] };
}
