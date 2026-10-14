import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { extname } from 'node:path';
import { createInterface } from 'node:readline';

const pipelineModule = new URL(`./css-pipeline${extname(import.meta.filename)}`, import.meta.url).href;
const loadedLine = 'pipeline loaded';
// This bound is high, so that a slow start does not fail a case. It stops a child that does not load at all.
const loadTimeLimitMs = 60_000;

// Runs `work` with `assert` and `createPipeline` in a new Node process and requires status 0.
// The time limit starts when the child has loaded the pipeline, so a slow process start or
// module load on a busy host does not count. At each limit, this process kills the child,
// also when the work blocks the child.
export async function assertWorkPassesInChild(work: string, timeLimitMs: number): Promise<void> {
  const child = spawn(process.execPath, ['--input-type=module', '--eval', `
    import assert from 'node:assert/strict';
    import { createPipeline } from ${JSON.stringify(pipelineModule)};
    // The work can block this process, so the line must be out before the work starts.
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
      `The child did not load the pipeline within ${loadTimeLimitMs} ms`);
    assert.ok(await resolvesWithin(closed, timeLimitMs),
      `The selector work did not end within ${timeLimitMs} ms`);
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
