// A run of the unit suite writes about 200 MB of coverage files, so the files of a folder are read one at a time.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { v8ScriptsOf, type V8Function } from './ast-metrics-coverage-format.ts';
import { CommandError } from './repository.ts';

export type SourceScript = { readonly path: string; readonly functions: readonly V8Function[] };

export function* sourceScriptsIn(folder: string, root: string): Generator<readonly SourceScript[]> {
  const distSource = `${pathToFileURL(join(root, 'dist', 'src')).href}/`;
  let sourceScripts = 0;
  for (const name of coverageFileNames(folder)) {
    const scripts = sourceScriptsOf(join(folder, name), distSource);
    sourceScripts += scripts.length;
    yield scripts;
  }
  // The files of another checkout name other paths. Without this check, they give an empty report.
  if (sourceScripts === 0) throw new CommandError(`The coverage files in ${folder} name no script under dist/src/ of ${root}.`);
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

function sourceScriptsOf(file: string, distSource: string): SourceScript[] {
  const scripts = v8ScriptsOf(readFileSync(file, 'utf8'));
  if (scripts === undefined) throw new CommandError(`${file} is not a V8 coverage file.`);
  return scripts.flatMap(({ url, functions }) => {
    const path = sourcePathOf(url, distSource);
    return path === undefined ? [] : [{ path, functions }];
  });
}

// tsc keeps the folders of src/ in dist/src/, so dist/src/a/b.js is the build of src/a/b.ts and no source map is needed.
function sourcePathOf(url: string, distSource: string): string | undefined {
  if (!url.startsWith(distSource) || !url.endsWith('.js')) return undefined;
  return `src/${decodeURIComponent(url.slice(distSource.length, -'.js'.length))}.ts`;
}
