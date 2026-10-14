import assert from 'node:assert/strict';
import childProcess, { type ExecFileException } from 'node:child_process';
import dns from 'node:dns/promises';
import { syncBuiltinESMExports } from 'node:module';
import { test, type TestContext } from 'node:test';
import { WebsiteFetcherLightpanda } from '../../../src/website-fetcher/website-fetcher-lightpanda.ts';

const url = 'https://example.com/';
const html = '<html>Configured runtime</html>';
const unconfigured = [[undefined, 'no executable'], ['', 'an empty executable']] as const;

function stubRuntime(t: TestContext, cause: ExecFileException | null = null) {
  t.mock.method(dns, 'lookup', async () => [{ address: '93.184.216.34', family: 4 }]);
  const execute = t.mock.method(childProcess, 'execFile', (...args: Parameters<typeof childProcess.execFile>) => {
    args[3]?.(cause, JSON.stringify({ url, http_status: 200, content: html, error: null }), '');
    return new childProcess.ChildProcess();
  });
  syncBuiltinESMExports();
  t.after(() => {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  });
  return execute;
}

for (const executable of ['/opt/lightpanda/lightpanda', '/opt/Lightpanda runtime/lightpanda;echo unexpected']) {
  test(`Given a fetcher constructed with ${executable}, when fetching, then it runs that executable directly without a shell`, async (t) => {
    const execute = stubRuntime(t);

    assert.deepEqual(await new WebsiteFetcherLightpanda(executable).fetchURL(url), { requestedUrl: url, finalUrl: url, html });
    assert.equal(execute.mock.callCount(), 1);
    const [command, args, options] = execute.mock.calls[0].arguments;
    assert.equal(command, executable);
    assert.equal(options?.shell, undefined);
    assert.equal(args?.at(-1), url);
  });
}

for (const [executable, description] of unconfigured) {
  test(`Given a fetcher constructed with ${description}, when fetching, then it uses lightpanda on PATH`, async (t) => {
    const execute = stubRuntime(t);

    await new WebsiteFetcherLightpanda(executable).fetchURL(url);
    assert.equal(execute.mock.callCount(), 1);
    assert.equal(execute.mock.calls[0].arguments[0], 'lightpanda');
  });
}

for (const [executable, description] of unconfigured) {
  test(`Given LIGHTPANDA_BIN is set in the process environment, when a fetcher constructed with ${description} fetches, then it ignores the variable and uses lightpanda on PATH`, async (t) => {
    t.mock.property(process, 'env', { ...process.env, LIGHTPANDA_BIN: '/opt/Environment runtime/lightpanda' });
    const execute = stubRuntime(t);
    const fetcher = new WebsiteFetcherLightpanda(executable);

    await fetcher.fetchURL(url);
    assert.equal(execute.mock.callCount(), 1);
    assert.equal(execute.mock.calls[0].arguments[0], 'lightpanda');
  });
}

for (const configured of [undefined, '/opt/Missing runtime/lightpanda']) {
  const executable = configured ?? 'lightpanda';
  test(`Given ${executable} is missing, when fetching, then the error names it and the setup guide but not the requested URL`, async (t) => {
    const requestedUrl = 'https://example.com/account?session=private-value';
    const cause = Object.assign(new Error(`spawn ${executable} ENOENT`), { code: 'ENOENT' });
    const execute = stubRuntime(t, cause);

    await assert.rejects(new WebsiteFetcherLightpanda(configured).fetchURL(requestedUrl), (error) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /Lightpanda/);
      assert.ok(error.message.includes(executable));
      assert.ok(error.message.includes('docs/lightpanda-runtime.md'));
      assert.doesNotMatch(error.message, /example\.com|session|private-value/);
      assert.equal(error.cause, cause);
      return true;
    });
    assert.equal(execute.mock.callCount(), 1);
    assert.equal(execute.mock.calls[0].arguments[0], executable);
  });
}

test('Given the host is offline, when the configured runtime fails to connect, then it preserves the failure', async (t) => {
  const executable = '/opt/Lightpanda runtime/lightpanda';
  const cause = Object.assign(new Error('Network is unreachable'), { code: 1 });
  const execute = stubRuntime(t, cause);

  await assert.rejects(new WebsiteFetcherLightpanda(executable).fetchURL(url), (error) => error === cause);
  assert.equal(execute.mock.callCount(), 1);
  assert.equal(execute.mock.calls[0].arguments[0], executable);
});
