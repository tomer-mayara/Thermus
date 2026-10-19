import { mkdirSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import { CommandError } from '../shared/repository.ts';

const waitLimitMs = 5_000;
const pause = new Int32Array(new SharedArrayBuffer(4));

// One folder lock protects the complete scan and publication, including different dates for one commit.
export function withTrendLock<T>(folder: string, action: () => T): T {
  const lock = join(folder, '.record-lock');
  try { mkdirSync(folder, { recursive: true }); }
  catch { throw new CommandError(`Cannot write the trend store ${folder}.`); }
  acquire(lock);
  try { return action(); }
  finally { rmdirSync(lock); }
}

function acquire(lock: string): void {
  const deadline = Date.now() + waitLimitMs;
  while (true) {
    try { mkdirSync(lock); return; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw new CommandError(`Cannot lock the trend store ${lock}.`);
      if (Date.now() >= deadline) throw new CommandError(`The trend store lock ${lock} is busy. After confirming that no writer is active, remove this lock directory and retry.`);
      Atomics.wait(pause, 0, 0, 20);
    }
  }
}
