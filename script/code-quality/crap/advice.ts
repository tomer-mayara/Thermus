import { coverageNeeded, type GoalAssessment } from './goals.ts';
import type { CrapGoals, GoalFunction } from './types.ts';

function adviceOf(paths: number, goal: { readonly value: number; readonly inclusive: boolean }): string {
  const percent = coverageNeeded(paths, goal);
  return percent === undefined ? 'split' : `cover ≥ ${percent}%`;
}

function workOf(entry: GoalFunction, goals: CrapGoals, assessment: GoalAssessment): string {
  const strict = { value: goals.limit, inclusive: false };
  const target = { value: goals.target, inclusive: true };
  if (assessment.unmeasured) {
    return adviceOf(entry.paths, entry.change === 'new' ? target : strict) === 'split' ? 'split; no coverage data' : 'no coverage data';
  }
  if (assessment.limitMiss) return adviceOf(entry.paths, strict);
  const advice = assessment.targetMiss ? `; for ${goals.target}: ${adviceOf(entry.paths, target)}` : '';
  return `ok${advice}`;
}

export function toDoOf(entry: GoalFunction, goals: CrapGoals, assessment: GoalAssessment): string {
  const advice = [workOf(entry, goals, assessment)];
  if (assessment.requiredMiss) advice.push('required new target missed');
  if (entry.change === 'unchanged') advice.push('unchanged by this PR');
  if (entry.change === 'unknown') advice.push('identity unknown: cannot classify the new-function target');
  return advice.join('; ');
}
