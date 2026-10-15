import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { assertHostedRenderer } from '../../src/hosted-renderer-startup.ts';

async function rendererFile(t: TestContext, program: string, mode = 0o755): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'thermus-startup-renderer-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const executable = join(directory, 'private-renderer-value');
  await writeFile(executable, `#!${process.execPath}\n${program}\n`, { mode });
  return executable;
}

test('Given the pinned version command, when hosted startup checks it, then the child gets no render request and telemetry is off', async (t) => {
  const executable = await rendererFile(t, `
if (process.argv.slice(2).join(',') !== 'version' || process.env.LIGHTPANDA_DISABLE_TELEMETRY !== 'true') process.exit(1);
console.log('1.0.0');`);

  await assertHostedRenderer(executable);
});

test('Given a missing or non-executable renderer, when hosted startup checks it, then each failure is safe and keeps no process cause', async (t) => {
  const executable = await rendererFile(t, `console.log('1.0.0');`, 0o600);

  for (const selected of [executable, `${executable}-missing`]) {
    await assert.rejects(assertHostedRenderer(selected), (error) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /did not complete its bounded version check/);
      assert.ok(!error.message.includes(selected));
      assert.equal(error.cause, undefined);
      return true;
    });
  }
});

test('Given an unsupported renderer version with private output, when hosted startup checks it, then it refuses without showing that output', async (t) => {
  const executable = await rendererFile(t, `console.log('private-version-secret');`);

  await assert.rejects(assertHostedRenderer(executable), (error) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /must report Lightpanda 1\.0\.0/);
    assert.doesNotMatch(error.message, /private-version-secret|private-renderer-value/);
    return true;
  });
});

for (const output of ['none', 'excess stdout', 'excess stderr']) {
  test(`Given a renderer with ${output} that ignores SIGTERM, when hosted startup checks it, then the check fails within its bound and its child is gone`, { timeout: 10_000 }, async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'thermus-startup-child-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const pidFile = join(directory, 'pid');
    const stream = output === 'excess stderr' ? 'stderr' : 'stdout';
    const executable = await rendererFile(t, `
const fs = require('node:fs');
fs.writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));
process.on('SIGTERM', () => {});
${output === 'none' ? '' : `process.${stream}.write('private-output-secret'.repeat(100));`}
setInterval(() => {}, 1000);`);
    t.after(async () => {
      const pid = Number(await readFile(pidFile, 'utf8').catch(() => '0'));
      if (pid > 0) try { process.kill(pid, 'SIGKILL'); } catch { /* The checked child has already exited. */ }
    });
    const started = Date.now();

    await assert.rejects(assertHostedRenderer(executable), (error) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /did not complete its bounded version check/);
      assert.doesNotMatch(error.message, /private-output-secret|private-renderer-value/);
      assert.equal(error.cause, undefined);
      return true;
    });

    assert.ok(Date.now() - started < 8_000);
    const pid = Number(await readFile(pidFile, 'utf8'));
    assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  });
}
