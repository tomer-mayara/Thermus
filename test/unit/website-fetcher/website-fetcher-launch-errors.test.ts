import assert from 'node:assert/strict';
import childProcess, { type ExecFileException } from 'node:child_process';
import dns from 'node:dns/promises';
import { test, type TestContext } from 'node:test';
import { WebsiteFetcherLightpanda } from '../../../src/website-fetcher/website-fetcher-lightpanda.ts';
import { WebsiteFetchHttpError, WebsiteFetchLaunchError } from '../../../src/website-fetcher/website-fetcher.ts';
import { syncBuiltinMocks } from '../../support/doubles/website-fetcher/builtin-mocks.ts';
import { RendererChildDouble } from '../../support/doubles/website-fetcher/renderer-process-double.ts';

const executable = '/opt/Lightpanda runtime/lightpanda';
const url = 'https://example.com/account?session=private-value';
const failedHttpOutput = JSON.stringify({ url, http_status: 404, content: '<html>Partial</html>', error: 'HttpError' });

// Node reports a process that cannot start with a string code. Its message and command repeat the arguments and the URL.
function launchFailure(code: string): ExecFileException {
  return Object.assign(new Error(`spawn ${executable} ${code}`), {
    code, errno: -2, syscall: `spawn ${executable}`, path: executable, spawnargs: ['fetch', url], cmd: `${executable} fetch ${url}`,
  });
}

function stubProcess(t: TestContext, complete: (callback: (error: ExecFileException | null, stdout: string, stderr: string) => void) => void) {
  const lookup = t.mock.method(dns, 'lookup', async () => [{ address: '93.184.216.34', family: 4 }]);
  const execute = t.mock.method(childProcess, 'execFile', (...args: Parameters<typeof childProcess.execFile>) => {
    const callback = args.at(-1);
    assert.ok(typeof callback === 'function');
    complete(callback);
    return new RendererChildDouble();
  });
  syncBuiltinMocks(t);
  return { lookup, execute };
}

const launchFailures = [
  { code: 'ENOENT', failure: 'missing', message: `Lightpanda executable "${executable}" was not found. See docs/lightpanda-runtime.md for setup.` },
  { code: 'EACCES', failure: 'cannot-start', message: `Lightpanda executable "${executable}" could not start (EACCES). See docs/lightpanda-runtime.md for setup.` },
] as const;

for (const { code, failure, message } of launchFailures) {
  test(`Given the renderer cannot start with ${code} and the output holds a failed HTTP status, when fetching, then a ${failure} launch error keeps the cause and shows no URL`, async (t) => {
    const cause = launchFailure(code);
    stubProcess(t, (complete) => complete(cause, failedHttpOutput, ''));

    await assert.rejects(new WebsiteFetcherLightpanda(executable).fetchURL(url), (error) => {
      assert.ok(error instanceof WebsiteFetchLaunchError);
      assert.ok(!(error instanceof WebsiteFetchHttpError));
      assert.deepEqual({ name: error.name, kind: error.kind, code: error.code, failure: error.failure, message: error.message }, {
        name: 'WebsiteFetchLaunchError', kind: 'launch', code, failure, message,
      });
      assert.equal(error.cause, cause);
      assert.doesNotMatch(error.message, /example\.com|session|private-value/);
      return true;
    });
  });
}

test('Given Node cannot start the renderer and throws ENOEXEC at once, when fetching, then a cannot-start launch error keeps the cause', async (t) => {
  const cause = Object.assign(new Error('spawn ENOEXEC'), { code: 'ENOEXEC', errno: -8, syscall: 'spawn' });
  stubProcess(t, () => { throw cause; });

  await assert.rejects(new WebsiteFetcherLightpanda(executable).fetchURL(url), (error) => {
    assert.ok(error instanceof WebsiteFetchLaunchError);
    assert.deepEqual({ code: error.code, failure: error.failure }, { code: 'ENOEXEC', failure: 'cannot-start' });
    assert.equal(error.message, `Lightpanda executable "${executable}" could not start (ENOEXEC). See docs/lightpanda-runtime.md for setup.`);
    assert.equal(error.cause, cause);
    return true;
  });
});

test('Given Node cannot start the renderer and throws a code without a system error name, such as for a Mach-O binary of another CPU, when fetching, then a cannot-start launch error shows UNKNOWN', async (t) => {
  const cause = Object.assign(new Error('spawn Unknown system error -86'), { code: 'Unknown system error -86', errno: -86, syscall: 'spawn' });
  stubProcess(t, () => { throw cause; });

  await assert.rejects(new WebsiteFetcherLightpanda(executable).fetchURL(url), (error) => {
    assert.ok(error instanceof WebsiteFetchLaunchError);
    assert.deepEqual({ code: error.code, failure: error.failure }, { code: 'UNKNOWN', failure: 'cannot-start' });
    assert.equal(error.message, `Lightpanda executable "${executable}" could not start (UNKNOWN). See docs/lightpanda-runtime.md for setup.`);
    assert.equal(error.cause, cause);
    return true;
  });
});

for (const code of ['EAGAIN', 'EMFILE', 'ENFILE', 'ENOMEM']) {
  test(`Given the renderer cannot start because the system reached the limit ${code}, when fetching, then the process error stays and is not a launch error`, async (t) => {
    const cause = launchFailure(code);
    stubProcess(t, (complete) => complete(cause, '', ''));

    await assert.rejects(new WebsiteFetcherLightpanda(executable).fetchURL(url), (error) => error === cause);
  });
}

test('Given a started renderer that the process timeout cannot stop because kill fails with EPERM, when fetching, then the process error stays and is not a launch error', async (t) => {
  const cause = Object.assign(new Error('kill EPERM'), { code: 'EPERM', errno: -1, syscall: 'kill' });
  stubProcess(t, (complete) => complete(cause, '', ''));

  await assert.rejects(new WebsiteFetcherLightpanda(executable).fetchURL(url), (error) => error === cause);
});

test('Given a launch error made with a code that is not a system error name, when it is made, then its code is UNKNOWN, so a report cannot show other text', () => {
  for (const code of ['ENOENT\nERROR forged line', 'https://example.com/', undefined, 42]) {
    const error = new WebsiteFetchLaunchError(code, 'Lightpanda executable could not start.');
    assert.deepEqual({ code: error.code, failure: error.failure }, { code: 'UNKNOWN', failure: 'cannot-start' });
  }
});

const startedProcessFailures: readonly { name: string; cause: ExecFileException; stdout: string }[] = [
  { name: 'an HTTP 404 error', cause: Object.assign(new Error('Command failed'), { code: 22 }), stdout: failedHttpOutput },
  { name: 'the process timeout', cause: Object.assign(new Error('Command failed'), { code: null, killed: true, signal: 'SIGTERM' as const }), stdout: failedHttpOutput },
  { name: 'a signal', cause: Object.assign(new Error('Command failed'), { code: null, killed: false, signal: 'SIGSEGV' as const }), stdout: '' },
  { name: 'the output limit', cause: Object.assign(new Error('stdout maxBuffer length exceeded'), { code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' }), stdout: '' },
];

for (const { name, cause, stdout } of startedProcessFailures) {
  test(`Given the renderer started and failed with ${name}, when fetching, then the failure is not a launch error`, async (t) => {
    stubProcess(t, (complete) => complete(cause, stdout, ''));

    await assert.rejects(new WebsiteFetcherLightpanda(executable).fetchURL(url), (error) => {
      assert.ok(!(error instanceof WebsiteFetchLaunchError));
      if (name === 'an HTTP 404 error') assert.ok(error instanceof WebsiteFetchHttpError);
      else assert.equal(error, cause);
      return true;
    });
  });
}

test('Given a DNS failure with the code ENOTFOUND, when fetching, then the renderer does not start and the failure is not a launch error', async (t) => {
  const cause = Object.assign(new Error('getaddrinfo ENOTFOUND example.com'), { code: 'ENOTFOUND' });
  const { lookup, execute } = stubProcess(t, (complete) => complete(null, '', ''));
  lookup.mock.mockImplementation(async () => { throw cause; });

  await assert.rejects(new WebsiteFetcherLightpanda(executable).fetchURL(url), (error) => error === cause);
  assert.equal(execute.mock.callCount(), 0);
});
