import assert from 'node:assert/strict';
import childProcess, { ChildProcess, type ExecFileException } from 'node:child_process';
import dns from 'node:dns/promises';
import { syncBuiltinESMExports } from 'node:module';
import { test, type TestContext } from 'node:test';
import { WebsiteFetcherLightpanda } from '../../src/website-fetcher/website-fetcher-lightpanda.ts';
import { WebsiteFetchHttpError } from '../../src/website-fetcher/website-fetcher.ts';

type Completion = (error: ExecFileException | null, stdout: string, stderr: string) => void;

function mockRenderer(t: TestContext) {
  const child = new ChildProcess();
  let finish!: Completion;
  let signalLaunch!: () => void;
  const launched = new Promise<void>((resolve) => { signalLaunch = resolve; });
  t.mock.method(dns, 'lookup', async () => [{ address: '93.184.216.34', family: 4 }]);
  t.mock.method(childProcess, 'execFile', ((...args: Parameters<typeof childProcess.execFile>) => {
    finish = args[3] as Completion;
    signalLaunch();
    return child;
  }) as typeof childProcess.execFile);
  syncBuiltinESMExports();
  t.after(() => {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  });
  return { child, fetcher: new WebsiteFetcherLightpanda(), launched, finish: (...args: Parameters<Completion>) => finish(...args) };
}

function setExitState(child: ChildProcess, state: { exitCode?: number; signalCode?: NodeJS.Signals }): void {
  for (const [property, value] of Object.entries(state)) {
    Object.defineProperty(child, property, { configurable: true, value });
  }
}

function successResult() {
  return JSON.stringify({ url: 'https://example.com/', http_status: 200, content: '<html>Ready</html>', error: null });
}

test('keeps a clean exit completed before the deadline when its callback is delayed', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const renderer = mockRenderer(t);
  const kill = t.mock.method(renderer.child, 'kill', () => true);
  const result = renderer.fetcher.fetchURL('https://example.com/');
  await renderer.launched;

  setExitState(renderer.child, { exitCode: 0 });
  t.mock.timers.tick(5_000);
  assert.equal(kill.mock.callCount(), 0);
  renderer.finish(null, successResult(), '');
  assert.equal((await result).html, '<html>Ready</html>');
});

test('preserves the original error when a failed exit precedes the deadline callback', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const renderer = mockRenderer(t);
  const kill = t.mock.method(renderer.child, 'kill', () => true);
  const result = renderer.fetcher.fetchURL('https://example.com/');
  await renderer.launched;

  setExitState(renderer.child, { signalCode: 'SIGTERM' });
  t.mock.timers.tick(5_000);
  assert.equal(kill.mock.callCount(), 0);
  const error: ExecFileException = Object.assign(new Error('Renderer terminated'), {
    killed: true,
    signal: 'SIGTERM' as const,
    code: null,
  });
  renderer.finish(error, '', '');
  await assert.rejects(result, (caught) => caught === error);
});

test('rejects a clean callback when the still-running child reached the deadline', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const renderer = mockRenderer(t);
  const kill = t.mock.method(renderer.child, 'kill', () => true);
  const result = renderer.fetcher.fetchURL('https://example.com/');
  await renderer.launched;

  t.mock.timers.tick(5_000);
  assert.equal(kill.mock.callCount(), 1);
  renderer.finish(null, successResult(), '');
  await assert.rejects(result, /Lightpanda readiness limit exceeded after 5000 ms/);
});

test('keeps an HTTP failure when the renderer exits before the readiness deadline', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const renderer = mockRenderer(t);
  const kill = t.mock.method(renderer.child, 'kill', () => true);
  const result = renderer.fetcher.fetchURL('https://example.com/');
  await renderer.launched;

  setExitState(renderer.child, { exitCode: 22 });
  t.mock.timers.tick(5_000);
  assert.equal(kill.mock.callCount(), 0);
  const cause = Object.assign(new Error('HTTP failure'), { code: 22 });
  renderer.finish(cause, JSON.stringify({ http_status: 500, content: '<html>Error page</html>', error: null }), '');

  await assert.rejects(result, (error) => {
    assert.ok(error instanceof WebsiteFetchHttpError);
    assert.equal(error.status, 500);
    assert.equal(error.cause, cause);
    return true;
  });
});

test('keeps a readiness failure when the late callback reports HTTP failure', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const renderer = mockRenderer(t);
  const kill = t.mock.method(renderer.child, 'kill', () => true);
  const result = renderer.fetcher.fetchURL('https://example.com/');
  await renderer.launched;

  t.mock.timers.tick(5_000);
  assert.equal(kill.mock.callCount(), 1);
  const cause = Object.assign(new Error('HTTP failure'), { code: 22 });
  renderer.finish(cause, JSON.stringify({ http_status: 500, content: '<html>Error page</html>', error: null }), '');

  await assert.rejects(result, (error) => {
    assert.ok(error instanceof Error);
    assert.ok(!(error instanceof WebsiteFetchHttpError));
    assert.equal(error.message, 'Lightpanda readiness limit exceeded after 5000 ms');
    assert.equal(error.cause, cause);
    return true;
  });
});
