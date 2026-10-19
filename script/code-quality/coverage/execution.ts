import type { V8Function } from './input.ts';
import { CommandError } from '../shared/repository.ts';

// covered uses the whole function coordinates; ownCharacters is the later ownership denominator.
// Keep these separate because child ranges can arrive in a different process.
export type MergedFunction = {
  readonly name: string; readonly start: number; readonly end: number;
  called: number; readonly covered: Uint8Array; ownCharacters: number;
};
// V8 block boundaries can differ between processes. Key each function by its name and whole range,
// then keep its execution mask separate from the masks of its parents and children.
export function addFunctionRuns(functions: Map<string, MergedFunction>, entry: V8Function): void {
  const [whole] = entry.ranges;
  const key = JSON.stringify([entry.functionName, whole.startOffset, whole.endOffset]);
  const merged = functions.get(key) ?? initialFunction(entry);
  addCalls(merged, whole.count);
  functions.set(key, merged);
  unionExecution(merged, entry);
}

function initialFunction({ functionName, ranges: [whole] }: V8Function): MergedFunction {
  const size = whole.endOffset - whole.startOffset;
  return {
    name: functionName, start: whole.startOffset, end: whole.endOffset,
    called: 0, covered: new Uint8Array(size), ownCharacters: size,
  };
}

// JavaScript loses integer precision past this boundary. Reject the sum before
// changing the prior count so the report cannot publish a rounded call count.
function addCalls(merged: MergedFunction, count: number): void {
  const called = merged.called + count;
  if (!Number.isSafeInteger(called)) throw new CommandError(`Coverage call count overflow for ${merged.name || '(anonymous)'}: the sum must be a safe integer.`);
  merged.called = called;
}

// Within one process, every zero block clears its full span; positive blocks cannot restore it.
// Between processes, coverage is a union of the resulting execution masks.
function unionExecution(merged: MergedFunction, { ranges }: V8Function): void {
  const ran = new Uint8Array(merged.covered.length).fill(1);
  for (const { startOffset, endOffset, count } of ranges) {
    if (count === 0) ran.fill(0, startOffset - merged.start, endOffset - merged.start);
  }
  ran.forEach((value, index) => { merged.covered[index] |= value; });
}
