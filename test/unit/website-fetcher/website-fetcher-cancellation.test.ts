import assert from 'node:assert/strict';
import childProcess, { ChildProcess, type ExecFileException } from 'node:child_process';
import dns from 'node:dns/promises';
import { getEventListeners } from 'node:events';
import { syncBuiltinESMExports } from 'node:module';
import { test } from 'node:test';
import { WebsiteFetcherLightpanda } from '../../../src/website-fetcher/website-fetcher-lightpanda.ts';
import { controlledRenderer, RendererChildDouble } from '../../support/doubles/website-fetcher/renderer-process-double.ts';

type Completion = (error: ExecFileException | null, stdout: string, stderr: string) => void;
const requestedUrl = 'https://EXAMPLE.com';
const success = JSON.stringify({ url: 'https://example.com/final', http_status: 200, content: '<html>Ready</html>', error: null });

test('Given a cancelled call, when fetching, then it does no DNS or renderer work', async (t) => {
  const renderer = controlledRenderer(t);
  const execute = t.mock.method(childProcess, 'execFile', ((...args: Parameters<typeof childProcess.execFile>): ChildProcess => {
    (args[3] as Completion)(null, success, '');
    return renderer.child;
  }) as typeof childProcess.execFile);
  syncBuiltinESMExports();
  const controller = new AbortController();
  controller.abort();

  await assert.rejects(new WebsiteFetcherLightpanda().fetchURL(requestedUrl, controller.signal), (error) => error === controller.signal.reason);
  assert.equal(renderer.lookup.mock.callCount(), 0);
  assert.equal(execute.mock.callCount(), 0);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

for (const dnsFails of [false, true]) {
  test(`Given DNS is pending, when the call is cancelled and DNS ${dnsFails ? 'fails' : 'completes'}, then no renderer starts`, async (t) => {
    const renderer = controlledRenderer(t);
    let completeLookup!: (addresses: Array<{ address: string; family: number }>) => void;
    let failLookup!: (error: Error) => void;
    t.mock.method(dns, 'lookup', () => new Promise((resolve, reject) => {
      completeLookup = resolve;
      failLookup = reject;
    }));
    const controller = new AbortController();
    const reason = new Error('Call cancelled');
    const result = new WebsiteFetcherLightpanda().fetchURL(requestedUrl, controller.signal);
    controller.abort(reason);
    if (dnsFails) failLookup(new Error('DNS failed'));
    else completeLookup([{ address: '93.184.216.34', family: 4 }]);

    await assert.rejects(result, (error) => error === reason);
    assert.equal(renderer.execute.mock.callCount(), 0);
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  });
}

for (const completion of ['success', 'process failure', 'HTTP failure'] as const) {
  test(`Given a running renderer, when cancelled before ${completion}, then it kills the child and rejects after cleanup`, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const renderer = controlledRenderer(t);
    const controller = new AbortController();
    const reason = new Error('Call cancelled');
    const result = new WebsiteFetcherLightpanda().fetchURL(requestedUrl, controller.signal);
    let settled = false;
    void result.then(() => { settled = true; }, () => { settled = true; });
    await renderer.launched;

    controller.abort(reason);
    assert.deepEqual(renderer.child.signals, ['SIGKILL']);
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
    await new Promise<void>((resolve) => { setImmediate(resolve); });
    assert.equal(settled, false);
    t.mock.timers.tick(60_000);
    assert.deepEqual(renderer.child.signals, ['SIGKILL']);
    const error = completion === 'success' ? null : Object.assign(new Error('Renderer failed'), { code: completion === 'HTTP failure' ? 22 : 1 });
    renderer.finish(error, success, '');

    await assert.rejects(result, (caught) => caught === reason);
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
    t.mock.timers.tick(60_000);
    assert.deepEqual(renderer.child.signals, ['SIGKILL']);
  });
}

for (const fails of [false, true]) {
  test(`Given a call with a signal, when the renderer ${fails ? 'fails' : 'completes'}, then it releases the abort listener and readiness timer`, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const renderer = controlledRenderer(t);
    const controller = new AbortController();
    const result = new WebsiteFetcherLightpanda().fetchURL(requestedUrl, controller.signal);
    await renderer.launched;
    assert.equal(getEventListeners(controller.signal, 'abort').length, 1);
    const error = fails ? new Error('Renderer failed') : null;
    renderer.finish(error, success, '');

    if (fails) await assert.rejects(result, (caught) => caught === error);
    else assert.deepEqual(await result, { requestedUrl, finalUrl: 'https://example.com/final', html: '<html>Ready</html>' });
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
    controller.abort();
    t.mock.timers.tick(60_000);
    assert.deepEqual(renderer.child.signals, []);
  });
}

test('Given renderer launch fails, when fetching with a signal, then it releases its listener and timer', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const renderer = controlledRenderer(t);
  const error = new Error('Launch failed');
  t.mock.method(childProcess, 'execFile', () => { throw error; });
  syncBuiltinESMExports();
  const controller = new AbortController();

  await assert.rejects(new WebsiteFetcherLightpanda().fetchURL(requestedUrl, controller.signal), (caught) => caught === error);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  controller.abort();
  t.mock.timers.tick(60_000);
  assert.deepEqual(renderer.child.signals, []);
});

test('Given cancellation happens while reading renderer output, when the result is ready, then it cannot return success', async (t) => {
  const renderer = controlledRenderer(t);
  const controller = new AbortController();
  const result = new WebsiteFetcherLightpanda().fetchURL(requestedUrl, controller.signal);
  await renderer.launched;
  const parse = JSON.parse;
  t.mock.method(JSON, 'parse', (text: string) => {
    const output: unknown = parse(text);
    controller.abort();
    return output;
  });
  renderer.finish(null, success, '');

  await assert.rejects(result, (error) => error === controller.signal.reason);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  assert.deepEqual(renderer.child.signals, []);
});

test('Given the readiness timer killed a renderer, when cancellation follows, then the child is killed once', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const renderer = controlledRenderer(t);
  const controller = new AbortController();
  const result = new WebsiteFetcherLightpanda().fetchURL(requestedUrl, controller.signal);
  const rejected = assert.rejects(result, (error) => error === controller.signal.reason);
  await renderer.launched;

  t.mock.timers.tick(20_000);
  controller.abort();
  controller.abort();
  renderer.finish(null, success, '');
  await rejected;

  assert.deepEqual(renderer.child.signals, ['SIGKILL']);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  t.mock.timers.tick(60_000);
  assert.deepEqual(renderer.child.signals, ['SIGKILL']);
});

test('Given a cancelled renderer completed, when its callback runs again, then cleanup runs once and no output is parsed', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const renderer = controlledRenderer(t);
  const controller = new AbortController();
  const parse = t.mock.method(JSON, 'parse');
  const result = new WebsiteFetcherLightpanda().fetchURL(requestedUrl, controller.signal);
  const rejected = assert.rejects(result, (error) => error === controller.signal.reason);
  await renderer.launched;
  const removeListener = t.mock.method(controller.signal, 'removeEventListener');

  controller.abort();
  renderer.finish(null, success, '');
  await rejected;
  renderer.finish(null, success, '');
  t.mock.timers.tick(60_000);

  assert.deepEqual(renderer.child.signals, ['SIGKILL']);
  assert.equal(removeListener.mock.callCount(), 1);
  assert.equal(parse.mock.callCount(), 0);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test('Given concurrent fetches share a fetcher, when one is cancelled, then the other keeps its result and resources', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const renderer = controlledRenderer(t);
  const otherChild = new RendererChildDouble();
  const completions: Completion[] = [];
  t.mock.method(childProcess, 'execFile', ((...args: Parameters<typeof childProcess.execFile>): ChildProcess => {
    completions.push(args[3] as Completion);
    return completions.length === 1 ? renderer.child : otherChild;
  }) as typeof childProcess.execFile);
  syncBuiltinESMExports();
  const cancelled = new AbortController();
  const other = new AbortController();
  const fetcher = new WebsiteFetcherLightpanda();
  const first = fetcher.fetchURL(requestedUrl, cancelled.signal);
  const second = fetcher.fetchURL('https://example.com/other', other.signal);
  const rejected = assert.rejects(first, (error) => error === cancelled.signal.reason);
  await new Promise<void>((resolve) => { setImmediate(resolve); });
  assert.equal(completions.length, 2);

  cancelled.abort();
  assert.deepEqual(renderer.child.signals, ['SIGKILL']);
  assert.deepEqual(otherChild.signals, []);
  assert.equal(getEventListeners(other.signal, 'abort').length, 1);
  const [firstCompletion, secondCompletion] = completions;
  assert.ok(firstCompletion);
  assert.ok(secondCompletion);
  secondCompletion(null, success, '');
  firstCompletion(null, success, '');
  await rejected;

  assert.deepEqual(await second, { requestedUrl: 'https://example.com/other', finalUrl: 'https://example.com/final', html: '<html>Ready</html>' });
  assert.equal(getEventListeners(other.signal, 'abort').length, 0);
  t.mock.timers.tick(60_000);
  assert.deepEqual(otherChild.signals, []);
});
