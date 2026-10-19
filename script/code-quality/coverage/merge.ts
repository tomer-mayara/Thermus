import type { SourceScript } from './input.ts';
import { addFunctionRuns, type MergedFunction } from './execution.ts';
export type { MergedFunction } from './execution.ts';
import type { ScriptIdentity } from './identity.ts';
import { validateScript } from './ranges.ts';
import { applyOwnership } from './ownership.ts';
import { CommandError } from '../shared/repository.ts';

export type MergedScript = ScriptIdentity & { readonly functions: Map<string, MergedFunction> };
export type MergedCoverage = { readonly processes: number; readonly scripts: ReadonlyMap<string, MergedScript> };

// A child absent from one process must still leave every parent mask.
// Apply ownership only after all process records have supplied their function ranges.
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
  const merged = compatibleScript(scripts, script);
  for (const entry of script.functions) addFunctionRuns(merged.functions, entry);
}

// Mapping two representations to one source path does not convert their offsets.
// Equal lengths cannot establish coordinate or content compatibility.
function compatibleScript(scripts: Map<string, MergedScript>, script: SourceScript): MergedScript {
  const { path, representation, contentIdentity, length } = script;
  const merged = scripts.get(path) ?? { ...script, functions: new Map<string, MergedFunction>() };
  if (merged.representation !== representation || merged.contentIdentity !== contentIdentity || merged.length !== length) {
    throw new CommandError(`Incompatible coverage representation or content identity for ${path}. Use scripts from one build and representation.`);
  }
  scripts.set(path, merged);
  return merged;
}
