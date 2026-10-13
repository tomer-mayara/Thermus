import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import {
  DataDirectoryInUseError,
  DataDirectoryUnavailableError,
  lockDataDirectory,
} from '../../../src/auth-better-auth/data-directory-lock.ts';

const moduleExtension = import.meta.url.endsWith('.ts') ? 'ts' : 'js';
const lockModule = new URL(`../../../src/auth-better-auth/data-directory-lock.${moduleExtension}`, import.meta.url).href;

function dataDirectory(t: TestContext): string {
  const directory = mkdtempSync(join(tmpdir(), 'magumagu-lock-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

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
