import type { SourceScript, V8Function } from './input.ts';
import type { ScriptIdentity } from './identity.ts';
import { validateScript } from './ranges.ts';
import { applyOwnership } from './ownership.ts';
import { CommandError } from '../shared/repository.ts';

export type MergedFunction = {
  readonly name: string; readonly start: number; readonly end: number;
  called: number; readonly covered: Uint8Array; ownCharacters: number;
};
export type MergedScript = ScriptIdentity & { readonly functions: Map<string, MergedFunction> };
export type MergedCoverage = { readonly processes: number; readonly scripts: ReadonlyMap<string, MergedScript> };

export function mergedCoverage(processes: Iterable<readonly SourceScript[]>): MergedCoverage {
  const scripts = new Map<string, MergedScript>();
  let count = 0;
  for (const processScripts of processes) {
    count += 1;
    for (const script of processScripts) addScript(scripts, script);
  }
  for (const script of scripts.values()) applyOwnership(script);
  return { processes: count, scripts };
}

function addScript(scripts: Map<string, MergedScript>, script: SourceScript): void {
  validateScript(script);
  const { path, representation, contentIdentity, length } = script;
  const merged = scripts.get(path) ?? { path, representation, contentIdentity, length, functions: new Map<string, MergedFunction>() };
  if (merged.representation !== representation || merged.contentIdentity !== contentIdentity || merged.length !== length) {
    throw new CommandError(`Incompatible coverage representation or content identity for ${path}. Use scripts from one build and representation.`);
  }
  scripts.set(path, merged);
  for (const entry of script.functions) addRuns(merged.functions, entry);
}

// Each process gives its own block ranges. Apply these before unioning execution between processes.
function addRuns(functions: Map<string, MergedFunction>, { functionName, ranges }: V8Function): void {
  const [whole] = ranges;
  const key = JSON.stringify([functionName, whole.startOffset, whole.endOffset]);
  const size = whole.endOffset - whole.startOffset;
  const merged = functions.get(key) ?? { name: functionName, start: whole.startOffset, end: whole.endOffset, called: 0, covered: new Uint8Array(size), ownCharacters: size };
  const called = merged.called + whole.count;
  if (!Number.isSafeInteger(called)) throw new CommandError(`Coverage call count overflow for ${functionName || '(anonymous)'}: the sum must be a safe integer.`);
  merged.called = called;
  functions.set(key, merged);
  const ran = new Uint8Array(size).fill(1);
  for (const { startOffset, endOffset, count } of ranges) {
    if (count === 0) ran.fill(0, startOffset - whole.startOffset, endOffset - whole.startOffset);
  }
  ran.forEach((value, index) => { merged.covered[index] |= value; });
}
