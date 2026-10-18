// The shape of the answer of get_file_metrics follows ast-metrics 0.43.1.
import { isJsonObject, jsonOf, numberOf, objectOf } from './ast-metrics-json.ts';
import { arrayOf, numberOrZero, textOf } from './ast-metrics-snapshot-json.ts';
import { rounded } from './ast-metrics-snapshot-numbers.ts';
import type { SnapshotFunction } from './ast-metrics-snapshot-types.ts';
import { CommandError } from './repository.ts';

// Each src/ file needs its answer: a snapshot with a gap would look complete.
export function snapshotFunctionsOf(path: string, text: string | undefined): SnapshotFunction[] {
  if (text === undefined) throw new CommandError(`get_file_metrics gave no answer for ${path}.`);
  const answer = jsonOf(text);
  if (!isJsonObject(answer)) throw new CommandError(`get_file_metrics gave an unexpected answer for ${path}: expected a JSON object.`);
  return arrayOf(answer.functions).map(functionOf);
}

// ast-metrics gives an anonymous function, such as a callback or a test case, an empty name. A function without code
// of its own has no maintainability index.
function functionOf(entry: unknown): SnapshotFunction {
  const fields = objectOf(entry);
  return {
    name: textOf(fields.name) || '(anonymous)',
    paths: numberOrZero(fields.cyclomatic_complexity),
    maintainability: rounded(numberOf(objectOf(fields.maintainability).maintainability_index), 1),
    loc: numberOrZero(objectOf(fields.volume).loc),
  };
}
