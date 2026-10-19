import { compareCrap, crapValueOf } from '../architecture/crap-score.ts';
import type { CrapGoals, GoalFunction } from './types.ts';

interface Goal {
  readonly value: number;
  readonly inclusive: boolean;
}

export interface GoalAssessment {
  readonly limitMiss: boolean;
  readonly targetMiss: boolean;
  readonly requiredMiss: boolean;
  readonly unmeasured: boolean;
  readonly requiredUnknown: boolean;
}

// Test whole percentages against the exact inequality; equality cannot pass a strict goal.
export function coverageNeeded(paths: number, goal: Goal): number | undefined {
  for (let percent = 0; percent <= 100; percent += 1) {
    const share = percent / 100;
    const comparison = compareCrap({ name: '', paths, share, crap: crapValueOf(paths, share) }, goal.value);
    if (comparison < 0 || (goal.inclusive && comparison === 0)) return percent;
  }
  return undefined;
}

export function goalAssessmentOf(entry: GoalFunction, goals: CrapGoals): GoalAssessment {
  const unmeasured = entry.share === undefined;
  const targetMiss = !unmeasured && compareCrap(entry, goals.target) > 0;
  return {
    limitMiss: compareCrap(entry, goals.limit) >= 0,
    targetMiss, unmeasured,
    requiredMiss: entry.change === 'new' && targetMiss,
    requiredUnknown: entry.change === 'unknown' || (entry.change !== 'unchanged' && unmeasured),
  };
}
