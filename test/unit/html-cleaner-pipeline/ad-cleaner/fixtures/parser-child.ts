import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { extname } from 'node:path';
import { createInterface } from 'node:readline';

const extension = extname(import.meta.filename);
const parserModule = new URL(`../../../../../src/pipelines/html-processing/ad-cleaner/adb/source-range-parser${extension}`, import.meta.url).href;
const childArguments = extension === '.ts' ? ['--import=tsx', '--input-type=module'] : ['--input-type=module'];
const loadedLine = 'parser loaded';
// The bound is high, so that a slow start does not fail a case. Only a child that does not load at all reaches it.
const loadTimeLimitMs = 60_000;

// The time limit starts after the child has loaded the parser, so that a slow process start or
// module load on a busy host does not count. The work runs in a child process, because this
// process cannot stop an EOF loop that blocks its own event loop.
export async function assertWorkPassesInChild(work: string, timeLimitMs: number): Promise<void> {
  const child = spawn(process.execPath, [...childArguments, '--eval', `
    import assert from 'node:assert/strict';
    import { adapter } from 'parse5-htmlparser2-tree-adapter';
    import { SourceRangeParser } from ${JSON.stringify(parserModule)};
    // The work can block this process. Thus, the write of the line must end before the work starts.
    await new Promise((resolve) => process.stdout.write(${JSON.stringify(`${loadedLine}\n`)}, resolve));
    ${work}
  `], { stdio: ['ignore', 'pipe', 'pipe'] });
  const closed = once(child, 'close');
  const loaded = new Promise<void>((resolve) => {
    createInterface({ input: child.stdout }).on('line', (line) => {
      if (line === loadedLine) resolve();
    });
  });
  let stderr = '';
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
    stderr += chunk;
  });
  try {
    assert.ok(await resolvesWithin(Promise.race([loaded, closed]), loadTimeLimitMs),
      `The child did not load the parser within ${loadTimeLimitMs} ms\n${stderr}`);
    assert.ok(await resolvesWithin(closed, timeLimitMs),
      `The parse work did not end within ${timeLimitMs} ms\n${stderr}`);
  } finally {
    child.kill('SIGKILL');
  }
  assert.equal(child.exitCode, 0, stderr);
}

async function resolvesWithin(promise: Promise<unknown>, ms: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<false>((resolve) => {
    timer = setTimeout(resolve, ms, false);
  });
  try {
    return await Promise.race([promise.then(() => true), late]);
  } finally {
    clearTimeout(timer);
  }
}
