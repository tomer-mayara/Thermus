import { isJsonObject, jsonOf } from '../shared/json.ts';
import type { JsonObject } from '../shared/json.ts';
import { CommandError } from '../shared/repository.ts';
import { snapshotFunctionsOf } from '../snapshot/input.ts';
import type { SnapshotFunction } from '../snapshot/types.ts';

export function measuredFunctionsOf(path: string, text: string, declarations: number): SnapshotFunction[] {
  const answer = jsonOf(text);
  if (isJsonObject(answer) && declarations === 0 && omittedEmptyFunctions(path, answer)) return [];
  if (!isJsonObject(answer) || !Array.isArray(answer.functions) || !answer.functions.every(validFunction)) {
    throw new CommandError(`get_file_metrics gave invalid function metrics for ${path}.`);
  }
  if (answer.functions.length < declarations) throw new CommandError(`get_file_metrics omitted source declarations in ${path}. The required goals are unresolved.`);
  return snapshotFunctionsOf(path, text);
}

// ast-metrics 0.43.1 omits functions for a constant module. Source evidence and
// explicit zero metrics must agree before this omission can mean an empty list.
function omittedEmptyFunctions(path: string, answer: JsonObject): boolean {
  if (answer.functions !== undefined || answer.path !== path || answer.cyclomatic_complexity !== 0 || answer.risk_score !== 0) return false;
  const lines = answer.lines_of_code;
  return isJsonObject(lines) && [lines.lines_of_code, lines.logical_lines, lines.comment_lines]
    .every((count) => Number.isSafeInteger(count) && (count as number) >= 0);
}

function validFunction(value: unknown): boolean {
  if (!isJsonObject(value)) return false;
  const paths = value.cyclomatic_complexity;
  return (paths === undefined || Number.isSafeInteger(paths) && (paths as number) >= 0) && (value.name === undefined || typeof value.name === 'string');
}
