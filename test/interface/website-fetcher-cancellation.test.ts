import assert from 'node:assert/strict';
import childProcess, { type ChildProcess } from 'node:child_process';
import { once, getEventListeners } from 'node:events';
import { syncBuiltinESMExports } from 'node:module';
import { test } from 'node:test';
import { WebsiteFetcherLightpanda } from '../../src/website-fetcher/website-fetcher-lightpanda.ts';
import type { WebsiteFetcher } from '../../src/website-fetcher/website-fetcher.ts';
import { permitIPv4Fixture, startFixture } from '../support/network-fixture.ts';

test('fetchURL accepts a pre-aborted signal and makes no request', async (t) => {
  const fixture = await startFixture(t, (_request, response) => response.end('<html>Ready</html>'));
  permitIPv4Fixture(t);
  const execute = t.mock.method(childProcess, 'execFile');
  syncBuiltinESMExports();
  const controller = new AbortController();
  controller.abort();
  const fetcher: WebsiteFetcher = new WebsiteFetcherLightpanda(process.env.LIGHTPANDA_BIN);

  await assert.rejects(fetcher.fetchURL(`${fixture.hostnameOrigin}/`, controller.signal), (error) => error === controller.signal.reason);
  assert.equal(fixture.connections, 0);
  assert.equal(execute.mock.callCount(), 0);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test('fetchURL rejects cancellation after the real renderer exits and releases its signal listener', { timeout: 10_000 }, async (t) => {
  let signalRequest!: () => void;
  const receivedRequest = new Promise<void>((resolve) => { signalRequest = resolve; });
  const fixture = await startFixture(t, () => { signalRequest(); });
  permitIPv4Fixture(t);
  const execute = childProcess.execFile;
  let child: ChildProcess | undefined;
  t.mock.method(childProcess, 'execFile', (...args: Parameters<typeof childProcess.execFile>) => {
    child = execute(...args);
    return child;
  });
  syncBuiltinESMExports();
  t.after(async () => {
    if (child !== undefined && child.exitCode === null && child.signalCode === null) {
      const closed = once(child, 'close');
      child.kill('SIGKILL');
      await closed;
    }
  });
  const controller = new AbortController();
  const fetcher: WebsiteFetcher = new WebsiteFetcherLightpanda(process.env.LIGHTPANDA_BIN);
  const result = fetcher.fetchURL(`${fixture.hostnameOrigin}/pending`, controller.signal);
  const rejection = assert.rejects(result, (error) => error === controller.signal.reason);
  await receivedRequest;

  assert.ok(child !== undefined && child.pid !== undefined);
  const pid = child.pid;
  controller.abort();
  await rejection;

  assert.equal(child.signalCode, 'SIGKILL');
  assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  assert.deepEqual(fixture.requests, ['/pending']);
});
