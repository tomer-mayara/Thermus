import assert from 'node:assert/strict';
import type { ChildProcess, ExecFileException } from 'node:child_process';
import { test } from 'node:test';
import { WebsiteFetcherLightpanda } from '../../../src/website-fetcher/website-fetcher-lightpanda.ts';
import { WebsiteFetchHttpError } from '../../../src/website-fetcher/website-fetcher.ts';
import { controlledRenderer } from '../../support/doubles/website-fetcher/renderer-process-double.ts';

function setExitState(child: ChildProcess, state: { exitCode?: number; signalCode?: NodeJS.Signals }): void {
  for (const [property, value] of Object.entries(state)) {
    Object.defineProperty(child, property, { configurable: true, value });
  }
}

function successResult() {
  return JSON.stringify({ url: 'https://example.com/', http_status: 200, content: '<html>Ready</html>', error: null });
}

test('Given asynchronous work is still running after five seconds, when it completes before twenty seconds, then the renderer is not killed and its complete HTML returns', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const renderer = controlledRenderer(t);
  const result = new WebsiteFetcherLightpanda().fetchURL('https://example.com/');
  await renderer.launched;

  t.mock.timers.tick(6_500);
  assert.deepEqual(renderer.child.signals, []);
  renderer.finish(null, successResult(), '');

  assert.equal((await result).html, '<html>Ready</html>');
});

test('keeps a clean exit completed before the deadline when its callback is delayed', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const renderer = controlledRenderer(t);
  const result = new WebsiteFetcherLightpanda().fetchURL('https://example.com/');
  await renderer.launched;

  setExitState(renderer.child, { exitCode: 0 });
  t.mock.timers.tick(20_000);
  assert.deepEqual(renderer.child.signals, []);
  renderer.finish(null, successResult(), '');
  assert.equal((await result).html, '<html>Ready</html>');
});

test('preserves the original error when a failed exit precedes the deadline callback', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const renderer = controlledRenderer(t);
  const result = new WebsiteFetcherLightpanda().fetchURL('https://example.com/');
  await renderer.launched;

  setExitState(renderer.child, { signalCode: 'SIGTERM' });
  t.mock.timers.tick(20_000);
  assert.deepEqual(renderer.child.signals, []);
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
  const renderer = controlledRenderer(t);
  const result = new WebsiteFetcherLightpanda().fetchURL('https://example.com/');
  await renderer.launched;

  t.mock.timers.tick(20_000);
  assert.deepEqual(renderer.child.signals, ['SIGKILL']);
  renderer.finish(null, successResult(), '');
  await assert.rejects(result, /Lightpanda readiness limit exceeded after 20000 ms/);
});

test('keeps an HTTP failure when the renderer exits before the readiness deadline', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const renderer = controlledRenderer(t);
  const result = new WebsiteFetcherLightpanda().fetchURL('https://example.com/');
  await renderer.launched;

  setExitState(renderer.child, { exitCode: 22 });
  t.mock.timers.tick(20_000);
  assert.deepEqual(renderer.child.signals, []);
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
  const renderer = controlledRenderer(t);
  const result = new WebsiteFetcherLightpanda().fetchURL('https://example.com/');
  await renderer.launched;

  t.mock.timers.tick(20_000);
  assert.deepEqual(renderer.child.signals, ['SIGKILL']);
  const cause = Object.assign(new Error('HTTP failure'), { code: 22 });
  renderer.finish(cause, JSON.stringify({ http_status: 500, content: '<html>Error page</html>', error: null }), '');

  await assert.rejects(result, (error) => {
    assert.ok(error instanceof Error);
    assert.ok(!(error instanceof WebsiteFetchHttpError));
    assert.equal(error.message, 'Lightpanda readiness limit exceeded after 20000 ms');
    assert.equal(error.cause, cause);
    return true;
  });
});
