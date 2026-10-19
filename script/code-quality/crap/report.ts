import { crapTextOf } from '../architecture/crap-format.ts';
import { textOrder } from '../shared/order.ts';
import { toDoOf } from './advice.ts';
import { goalAssessmentOf } from './goals.ts';
import type { CrapGoals, GoalFunction } from './types.ts';

function rowOf(entry: GoalFunction, goals: CrapGoals): string {
  const covered = entry.share === undefined ? 'unknown' : `${Number((entry.share * 100).toPrecision(15))}%`;
  const cells = [entry.file, entry.name, entry.change, String(entry.paths), covered, crapTextOf(entry, [goals.limit, goals.target]), toDoOf(entry, goals, goalAssessmentOf(entry, goals))];
  return `| ${cells.map((cell) => cell.replaceAll('|', '\\|').replaceAll('\n', ' ')).join(' | ')} |`;
}

function byRisk(first: GoalFunction, second: GoalFunction): number {
  return second.crap - first.crap || textOrder(first.file, second.file) || textOrder(first.name, second.name) || textOrder(first.identity, second.identity);
}

export function crapReportOf(rows: readonly GoalFunction[], goals: CrapGoals): { text: string; passed: boolean } {
  const assessments = rows.map((entry) => goalAssessmentOf(entry, goals));
  const violations = assessments.filter(({ limitMiss }) => limitMiss).length;
  const targetMisses = assessments.filter(({ targetMiss }) => targetMiss).length;
  const requiredMisses = assessments.filter(({ requiredMiss }) => requiredMiss).length;
  const unmeasured = assessments.filter(({ unmeasured }) => unmeasured).length;
  const unknown = assessments.filter(({ requiredUnknown }) => requiredUnknown).length;
  const text = [
    '## CRAP goals', '',
    `Goals: CRAP < ${goals.limit}; new functions also CRAP ≤ ${goals.target}.`, '',
    '| File | Function | Change | Paths | Coverage | CRAP | To do |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...[...rows].sort(byRisk).map((entry) => rowOf(entry, goals)), '',
    `Known limit violations: ${violations}. Measured target misses: ${targetMisses}. Unmeasured functions: ${unmeasured}. Required functions with unknown assessment or identity: ${unknown}.`,
    ...(unmeasured > 0 ? ['Unmeasured values are lower bounds; the known violation count is not an exact total.'] : []),
  ].join('\n');
  return { text, passed: violations === 0 && requiredMisses === 0 && unknown === 0 };
}
