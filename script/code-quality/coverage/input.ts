// A run of the unit suite writes about 200 MB of coverage files, so the files of a folder are read one at a time.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { scriptIdentityOf, type ScriptIdentity } from './identity.ts';
import { jsonOf, objectOf } from '../shared/json.ts';
import { CommandError } from '../shared/repository.ts';

export type SourceScript = ScriptIdentity & { readonly functions: readonly V8Function[] };

export function* sourceScriptsIn(folder: string, root: string): Generator<readonly SourceScript[]> {
  let sourceScripts = 0;
  for (const name of coverageFileNames(folder)) {
    const scripts = sourceScriptsOf(join(folder, name), root);
    sourceScripts += scripts.length;
    yield scripts;
  }
  // The files of another checkout name other paths. Without this check, they give an empty report.
  if (sourceScripts === 0) throw new CommandError(`The coverage files in ${folder} name no script under dist/src/ or src/ of ${root}.`);
}

function coverageFileNames(folder: string): string[] {
  let names: string[];
  try {
    names = readdirSync(folder);
  } catch {
    throw new CommandError(`Cannot read the folder ${folder}.`);
  }
  const coverage = names.filter((name) => /^coverage-.*\.json$/.test(name)).sort();
  if (coverage.length === 0) throw new CommandError(`${folder} holds no V8 coverage file (coverage-*.json).`);
  return coverage;
}

function sourceScriptsOf(file: string, root: string): SourceScript[] {
  const scripts = v8ScriptsOf(readFileSync(file, 'utf8'));
  if (scripts === undefined) throw new CommandError(`${file} is not a V8 coverage file.`);
  return scripts.flatMap(({ url, functions }) => {
    const identity = scriptIdentityOf(url, root);
    return identity === undefined ? [] : [{ ...identity, functions }];
  });
}

// The file that each Node process writes at exit when NODE_V8_COVERAGE names a folder. Offsets are characters (UTF-16
// code units) of the executed script representation, not bytes.
type V8Range = { readonly startOffset: number; readonly endOffset: number; readonly count: number };

// The first range is the whole function with the count of its calls. The other ranges are blocks inside it, each with
// its own count. V8 gives a block only where its count differs from the count around it.
export type V8Function = { readonly functionName: string; readonly ranges: readonly [V8Range, ...V8Range[]] };

type V8Script = { readonly url: string; readonly functions: readonly V8Function[] };

function v8ScriptsOf(text: string): readonly V8Script[] | undefined {
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
