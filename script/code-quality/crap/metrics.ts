import { isJsonObject, jsonOf } from '../shared/json.ts';
import { CommandError } from '../shared/repository.ts';
import { snapshotFunctionsOf } from '../snapshot/input.ts';
import type { SnapshotFunction } from '../snapshot/types.ts';

export function measuredFunctionsOf(path: string, text: string, declarations: number): SnapshotFunction[] {
  const answer = jsonOf(text);
  if (!isJsonObject(answer) || !Array.isArray(answer.functions) || !answer.functions.every(validFunction)) {
    throw new CommandError(`get_file_metrics gave invalid function metrics for ${path}.`);
  }
  if (answer.functions.length < declarations) throw new CommandError(`get_file_metrics omitted source declarations in ${path}. The required goals are unresolved.`);
  return snapshotFunctionsOf(path, text);
}

function validFunction(value: unknown): boolean {
  if (!isJsonObject(value)) return false;
  const paths = value.cyclomatic_complexity;
  return (paths === undefined || Number.isSafeInteger(paths) && (paths as number) >= 0) && (value.name === undefined || typeof value.name === 'string');
}
