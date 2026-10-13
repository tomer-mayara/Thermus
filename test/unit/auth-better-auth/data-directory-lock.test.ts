import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { test, type TestContext } from 'node:test';
import {
  DataDirectoryInUseError,
  DataDirectoryUnavailableError,
  lockDataDirectory,
} from '../../../src/auth-better-auth/data-directory-lock.ts';
import { dataDirectory } from '../../support/data-directory.ts';

const moduleExtension = import.meta.url.endsWith('.ts') ? 'ts' : 'js';
const lockModule = new URL(`../../../src/auth-better-auth/data-directory-lock.${moduleExtension}`, import.meta.url).href;
const concurrentLockers = 3;
const concurrentRounds = 50;

async function lockInOtherProcess(t: TestContext, directory: string) {
  const holder = spawn(process.execPath, ['--input-type=module', '-e', `
    const { lockDataDirectory } = await import(${JSON.stringify(lockModule)});
    lockDataDirectory(${JSON.stringify(directory)});
    console.log('locked');
    setInterval(() => {}, 1_000);
  `], { stdio: ['ignore', 'pipe', 'inherit'] });
  t.after(() => holder.kill('SIGKILL'));
  const [line] = await once(holder.stdout.setEncoding('utf8'), 'data');
  assert.equal(String(line).trim(), 'locked');
  return holder;
}

async function startLockingProcess(t: TestContext) {
  const locker = spawn(process.execPath, ['--input-type=module', '-e', `
    const { createInterface } = await import('node:readline');
    const { lockDataDirectory } = await import(${JSON.stringify(lockModule)});
    const heldUntilExit = [];
    console.log('ready');
    for await (const directory of createInterface({ input: process.stdin })) {
      try {
        heldUntilExit.push(lockDataDirectory(directory));
        console.log('locked');
      } catch (error) {
        console.log(error.name);
      }
    }
  `], { stdio: ['pipe', 'pipe', 'inherit'] });
  t.after(() => locker.kill('SIGKILL'));
  const lines = createInterface({ input: locker.stdout })[Symbol.asyncIterator]();
  assert.equal((await lines.next()).value, 'ready');
  return {
    lock: (directory: string): void => {
      locker.stdin.write(`${directory}\n`);
    },
    outcome: async (): Promise<string> => String((await lines.next()).value),
  };
}

test('Given a locked data directory, when the same process locks it again, then it fails with DataDirectoryInUseError until the first lock is released', (t) => {
  const directory = dataDirectory(t);
  const first = lockDataDirectory(directory);

  assert.throws(() => lockDataDirectory(directory), DataDirectoryInUseError);
  first.release();
  const second = lockDataDirectory(directory);
  second.release();
});

test('Given a released lock, when it is released again, then nothing happens', (t) => {
  const lock = lockDataDirectory(dataDirectory(t));

  lock.release();
  lock.release();
});

test('Given a data directory that another process locks, when this process locks it, then it fails until that process ends, also without a release', { timeout: 20_000 }, async (t) => {
  const directory = dataDirectory(t);
  const holder = await lockInOtherProcess(t, directory);

  assert.throws(() => lockDataDirectory(directory), (error) => {
    assert.ok(error instanceof DataDirectoryInUseError);
    assert.equal(error.message, 'The data directory is in use by another Magumagu process. Stop that process, then try again.');
    return true;
  });
  holder.kill('SIGKILL');
  await once(holder, 'exit');
  lockDataDirectory(directory).release();
});

test('Given a data directory that another process locks, when this process locks it, then it fails at once and does not wait for the holder', { timeout: 20_000 }, async (t) => {
  const directory = dataDirectory(t);
  await lockInOtherProcess(t, directory);
  const started = performance.now();

  assert.throws(() => lockDataDirectory(directory), DataDirectoryInUseError);
  const elapsed = performance.now() - started;

  assert.ok(elapsed < 1_000, `The lock failed after ${elapsed} ms`);
});

test('Given a fresh data directory in each round, when several processes lock it at the same time, then exactly one gets the lock and each other process gets DataDirectoryInUseError', { timeout: 30_000 }, async (t) => {
  const lockers = await Promise.all(Array.from({ length: concurrentLockers }, () => startLockingProcess(t)));
  const failedRounds: string[] = [];

  for (let round = 1; round <= concurrentRounds; round += 1) {
    const directory = dataDirectory(t);
    for (const locker of lockers) locker.lock(directory);
    const outcomes = await Promise.all(lockers.map((locker) => locker.outcome()));

    const holders = outcomes.filter((outcome) => outcome === 'locked').length;
    const refusals = outcomes.filter((outcome) => outcome === 'DataDirectoryInUseError').length;
    if (holders !== 1 || refusals !== concurrentLockers - 1) failedRounds.push(`round ${round}: ${outcomes.join(', ')}`);
  }

  assert.deepEqual(failedRounds, [], `${failedRounds.length} of ${concurrentRounds} rounds did not give exactly one lock holder:\n${failedRounds.join('\n')}`);
});

test('Given a free data directory, when it is locked and released, then the directory holds only the lock file', (t) => {
  const directory = dataDirectory(t);

  lockDataDirectory(directory).release();

  assert.deepEqual(readdirSync(directory), ['data-directory.lock']);
});

test('Given a missing data directory or a file in its place, when the process locks it, then it fails with DataDirectoryUnavailableError and creates nothing', (t) => {
  const parent = dataDirectory(t);
  const file = join(parent, 'regular-file');
  writeFileSync(file, 'not a directory');

  for (const directory of [join(parent, 'missing'), file]) {
    assert.throws(() => lockDataDirectory(directory), (error) => {
      assert.ok(error instanceof DataDirectoryUnavailableError);
      assert.equal(error.message, 'DATA_DIR must name an existing directory.');
      return true;
    });
  }
  assert.deepEqual(readdirSync(parent), ['regular-file']);
});
