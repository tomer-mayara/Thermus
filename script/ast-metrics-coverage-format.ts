// The file that each Node process writes at exit when NODE_V8_COVERAGE names a folder. Offsets are characters (UTF-16
// code units) of the compiled JavaScript, not bytes.
import { jsonOf, objectOf } from './ast-metrics-json.ts';

export type V8Range = { readonly startOffset: number; readonly endOffset: number; readonly count: number };

// The first range is the whole function with the count of its calls. The other ranges are blocks inside it, each with
// its own count. V8 gives a block only where its count differs from the count around it.
export type V8Function = { readonly functionName: string; readonly ranges: readonly [V8Range, ...V8Range[]] };

export type V8Script = { readonly url: string; readonly functions: readonly V8Function[] };

export function v8ScriptsOf(text: string): readonly V8Script[] | undefined {
  const { result } = objectOf(jsonOf(text));
  return isScriptList(result) ? result : undefined;
}

function isScriptList(value: unknown): value is V8Script[] {
  return Array.isArray(value) && value.every(isScript);
}

function isScript(value: unknown): value is V8Script {
  const { url, functions } = objectOf(value);
  return typeof url === 'string' && Array.isArray(functions) && functions.every(isFunction);
}

function isFunction(value: unknown): value is V8Function {
  const { functionName, ranges } = objectOf(value);
  return typeof functionName === 'string' && Array.isArray(ranges) && ranges.length > 0 && ranges.every(isRange);
}

function isRange(value: unknown): value is V8Range {
  const { startOffset, endOffset, count } = objectOf(value);
  return [startOffset, endOffset, count].every((field) => typeof field === 'number');
}
