import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { test } from 'node:test';
import { assertHostedRenderer } from '../../src/hosted-renderer-startup.ts';
import { syncBuiltinMocks } from '../support/doubles/website-fetcher/builtin-mocks.ts';

for (const executable of [undefined, '', 'lightpanda']) {
  test(`Given the hosted executable is ${String(executable)}, when startup checks it, then it refuses before starting a child`, async (t) => {
    const execute = t.mock.method(childProcess, 'execFile');
    syncBuiltinMocks(t);

    await assert.rejects(assertHostedRenderer(executable), /Hosted renderer setup failed: LIGHTPANDA_BIN must name an absolute path/);

    assert.equal(execute.mock.callCount(), 0);
  });
}

test('Given a configured executable, when startup checks its version, then it runs the version command directly with fixed limits, forceful cleanup, and telemetry off', async (t) => {
  const executable = '/opt/Lightpanda runtime/lightpanda;private';
  const execute = t.mock.method(childProcess, 'execFile', (...args: Parameters<typeof childProcess.execFile>) => {
    args[3]?.(null, '1.0.0\n', '');
    return {} as ReturnType<typeof childProcess.execFile>;
  });
  syncBuiltinMocks(t);

  await assertHostedRenderer(executable);

  assert.equal(execute.mock.callCount(), 1);
  const [command, args, options] = execute.mock.calls[0].arguments;
  assert.equal(command, executable);
  assert.deepEqual(args, ['version']);
  assert.equal(options?.shell, undefined);
  assert.equal(options?.timeout, 5_000);
  assert.equal(options?.maxBuffer, 1_024);
  assert.equal(options?.killSignal, 'SIGKILL');
  assert.equal(options?.env?.LIGHTPANDA_DISABLE_TELEMETRY, 'true');
});

for (const failure of ['unsupported', 'process', 'synchronous']) {
  test(`Given a ${failure} version check failure, when startup checks it, then its error shows no path, child output, or cause`, async (t) => {
    const secret = 'private-renderer-value';
    t.mock.method(childProcess, 'execFile', (...args: Parameters<typeof childProcess.execFile>) => {
      if (failure === 'synchronous') throw new Error(secret);
      args[3]?.(failure === 'process' ? new Error(secret) : null, secret, secret);
      return {} as ReturnType<typeof childProcess.execFile>;
    });
    syncBuiltinMocks(t);

    await assert.rejects(assertHostedRenderer(`/opt/${secret}`), (error) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /Hosted renderer setup failed: LIGHTPANDA_BIN/);
      assert.match(error.message, /docs\/lightpanda-runtime\.md/);
      assert.ok(!error.message.includes(secret));
      assert.equal(error.cause, undefined);
      return true;
    });
  });
}
