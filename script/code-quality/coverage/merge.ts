import type { SourceScript, V8Function } from './input.ts';
import { CommandError } from '../shared/repository.ts';

// covered has one entry for each character of the function: 1 when at least one process ran it.
export type MergedFunction = { readonly name: string; readonly start: number; readonly end: number; called: number; readonly covered: Uint8Array };

// The functions of a script by their range. The block ranges of a function differ from process to process, because
// V8 gives a block only where its count differs from the count around it. The range of the function does not.
export type MergedScript = { readonly length: number; readonly functions: Map<string, MergedFunction> };

export type MergedCoverage = { readonly processes: number; readonly scripts: ReadonlyMap<string, MergedScript> };

export function mergedCoverage(processes: Iterable<readonly SourceScript[]>): MergedCoverage {
  const scripts = new Map<string, MergedScript>();
  let count = 0;
  for (const processScripts of processes) {
    count += 1;
    for (const script of processScripts) addScript(scripts, script);
  }
  return { processes: count, scripts };
}

// The module function holds all other functions, so the largest end is the length of the build of the script. Two
// lengths for one script mean two builds, whose offsets do not match.
function addScript(scripts: Map<string, MergedScript>, { path, functions }: SourceScript): void {
  const length = Math.max(...functions.map(({ ranges }) => ranges[0].endOffset));
  const merged = scripts.get(path) ?? { length, functions: new Map<string, MergedFunction>() };
  if (merged.length !== length) {
    throw new CommandError(`The coverage files disagree on the length of the build of ${path}: ${merged.length} and ${length} characters. They come from two builds; use the files of one run.`);
  }
  scripts.set(path, merged);
  for (const entry of sourceFunctions(functions)) addRuns(merged.functions, entry);
}

// tsc writes its helpers, such as __addDisposableResource, into the build. They and the functions inside them are not
// source code.
function sourceFunctions(functions: readonly V8Function[]): V8Function[] {
  const helpers = functions.filter(({ functionName }) => functionName.startsWith('__')).map(({ ranges }) => ranges[0]);
  return functions.filter(({ ranges: [whole] }) => !helpers.some((helper) => helper.startOffset <= whole.startOffset && whole.endOffset <= helper.endOffset));
}

// The process ran each character of the function outside its blocks with count zero. The first range is the whole
// function, so the process ran no character of a function that it did not call.
function addRuns(functions: Map<string, MergedFunction>, { functionName, ranges }: V8Function): void {
  const [whole] = ranges;
  const key = `${whole.startOffset}-${whole.endOffset}`;
  const size = Math.max(0, whole.endOffset - whole.startOffset);
  const merged = functions.get(key) ?? { name: functionName, start: whole.startOffset, end: whole.endOffset, called: 0, covered: new Uint8Array(size) };
  functions.set(key, merged);
  merged.called += whole.count;
  const ran = new Uint8Array(size).fill(1);
  for (const { startOffset, endOffset, count } of ranges) {
    // fill counts a negative index from the end. A block outside the function must not reach into it.
    if (count === 0) ran.fill(0, Math.max(0, startOffset - whole.startOffset), Math.max(0, endOffset - whole.startOffset));
  }
  ran.forEach((value, index) => { merged.covered[index] |= value; });
}
