import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// The V8 coverage files that Node writes at exit, one file for each process, when NODE_V8_COVERAGE names a folder.
// A range is [start, end, count] in offsets of the compiled JavaScript. The first range of a function is the whole
// function with the count of its calls; the other ranges are blocks inside it, each with its own count.
type Range = readonly [start: number, end: number, count: number];
export type FunctionRuns = readonly [name: string, whole: Range, ...blocks: Range[]];

// The key is the path of a script from the root.
export type ProcessRuns = Readonly<Record<string, readonly FunctionRuns[]>>;

// The command keeps a script by its url, so each url is the file URL under the root, as Node gives it.
export function v8CoverageOf(root: string, scripts: ProcessRuns): string {
  const result = Object.entries(scripts).map(([path, functions], index) => ({
    scriptId: String(index + 1),
    url: pathToFileURL(join(root, path)).href,
    functions: functions.map(([functionName, ...ranges]) => ({
      functionName,
      ranges: ranges.map(([startOffset, endOffset, count]) => ({ startOffset, endOffset, count })),
      isBlockCoverage: true,
    })),
  }));
  return `${JSON.stringify({ result, timestamp: 52_000.5 })}\n`;
}

// The command reads the files in the order of their names, so the names keep the order of the list.
export function writeV8Coverage(folder: string, root: string, processes: readonly ProcessRuns[]): void {
  mkdirSync(folder, { recursive: true });
  processes.forEach((scripts, index) => {
    writeFileSync(join(folder, `coverage-${4000 + index}-1792300000000-0.json`), v8CoverageOf(root, scripts));
  });
}
