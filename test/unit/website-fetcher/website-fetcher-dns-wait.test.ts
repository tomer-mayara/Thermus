import { WebsiteFetchFailure } from '../../../src/website-fetcher/fetch-diagnostic.ts';
import assert from 'node:assert/strict';
import dns from 'node:dns/promises';
import { getEventListeners } from 'node:events';
import { setImmediate } from 'node:timers/promises';
import { test, type TestContext } from 'node:test';
import { WebsiteFetcherLightpanda } from '../../../src/website-fetcher/website-fetcher-lightpanda.ts';
import { controlledRenderer } from '../../support/doubles/website-fetcher/renderer-process-double.ts';

function pendingDns(t: TestContext) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const renderer = controlledRenderer(t);
  const answer = Promise.withResolvers<Array<{ address: string; family: number }>>();
  const lookup = t.mock.method(dns, 'lookup', () => answer.promise);
  const scheduled = t.mock.method(globalThis, 'setTimeout');
  const cleared = t.mock.method(globalThis, 'clearTimeout');
  const controller = new AbortController();
  const fetcher = new WebsiteFetcherLightpanda();
  const result = fetcher.fetchURL('https://pending.test/', controller.signal);
  const assertReleased = () => {
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
    const waitTimer = scheduled.mock.calls.find(({ arguments: args }) => args[1] === 5_000)?.result;
    assert.ok(waitTimer, 'DNS wait has a five-second timer');
    assert.equal(cleared.mock.calls.filter(({ arguments: args }) => args[0] === waitTimer).length, 1);
  };
  return { renderer, answer, controller, result, fetcher, lookup, assertReleased };
}

test('Given DNS never answers, when five seconds pass, then fetching fails without starting a renderer', async (t) => {
  const pending = pendingDns(t);
  let settled = false;
  void pending.result.then(() => { settled = true; }, () => { settled = true; });
  const rejected = assert.rejects(pending.result, /DNS lookup timed out after 5000 ms/);
  t.mock.timers.tick(4_999);
  await setImmediate();
  assert.equal(settled, false);
  t.mock.timers.tick(1);
  await rejected;
  pending.assertReleased();
  assert.equal(pending.renderer.execute.mock.callCount(), 0);
});

for (const lateOutcome of ['success', 'failure'] as const) {
  for (const stop of ['cancellation', 'timeout'] as const) {
    test(`Given DNS is pending, when ${stop} stops waiting before late DNS ${lateOutcome}, then no renderer starts and resources are released`, async (t) => {
      const pending = pendingDns(t);
      const reason = new Error('Call cancelled');
      const rejected = assert.rejects(pending.result, stop === 'cancellation'
        ? (error: unknown) => error === reason
        : /DNS lookup timed out after 5000 ms/);
      if (stop === 'cancellation') pending.controller.abort(reason);
      else t.mock.timers.tick(5_000);
      await rejected;
      pending.assertReleased();
      if (lateOutcome === 'success') pending.answer.resolve([{ address: '1.1.1.1', family: 4 }]);
      else pending.answer.reject(new Error('Late DNS failure'));
      await setImmediate();
      pending.controller.abort();
      t.mock.timers.tick(60_000);
      assert.equal(pending.renderer.execute.mock.callCount(), 0);
      pending.assertReleased();
    });
  }
}

test('Given DNS fails before the deadline, when fetching rejects, then it releases the wait resources and preserves the cause', async (t) => {
  const pending = pendingDns(t);
  const reason = new Error('DNS unavailable');
  const rejected = assert.rejects(pending.result, (error) => error instanceof WebsiteFetchFailure && error.cause === reason);
  pending.answer.reject(reason);
  await rejected;
  pending.assertReleased();
  pending.controller.abort();
  t.mock.timers.tick(60_000);
  assert.equal(pending.renderer.execute.mock.callCount(), 0);
});

test('Given DNS succeeds just before the deadline, when the page renders, then the old DNS deadline cannot stop the renderer', async (t) => {
  const pending = pendingDns(t);
  t.mock.timers.tick(4_999);
  pending.answer.resolve([{ address: '1.1.1.1', family: 4 }]);
  await pending.renderer.launched;
  t.mock.timers.tick(1);
  assert.deepEqual(pending.renderer.child.signals, []);
  pending.renderer.finish(null, JSON.stringify({ url: 'https://pending.test/', http_status: 200, content: '<p>Ready</p>', error: null }), '');
  assert.equal((await pending.result).html, '<p>Ready</p>');
  pending.assertReleased();
});

test('Given DNS succeeds as cancellation occurs, when the lookup continuation runs, then cancellation prevents the renderer launch', async (t) => {
  const pending = pendingDns(t);
  const rejected = assert.rejects(pending.result, (error) => error === pending.controller.signal.reason);
  pending.answer.resolve([{ address: '1.1.1.1', family: 4 }]);
  pending.controller.abort();
  await rejected;
  pending.assertReleased();
  assert.equal(pending.renderer.execute.mock.callCount(), 0);
});

test('Given the DNS API throws during lookup, when fetching rejects, then the wait resources are released', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const renderer = controlledRenderer(t);
  const failure = new Error('Lookup failed synchronously');
  t.mock.method(dns, 'lookup', () => { throw failure; });
  const scheduled = t.mock.method(globalThis, 'setTimeout');
  const cleared = t.mock.method(globalThis, 'clearTimeout');
  const controller = new AbortController();
  await assert.rejects(new WebsiteFetcherLightpanda().fetchURL('https://pending.test/', controller.signal), (error) => error instanceof WebsiteFetchFailure && error.cause === failure);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  assert.ok(scheduled.mock.calls[0]?.result);
  assert.equal(cleared.mock.calls[0]?.arguments[0], scheduled.mock.calls[0]?.result);
  assert.equal(renderer.execute.mock.callCount(), 0);
});

for (const stop of ['cancellation', 'timeout'] as const) {
  for (const lateOutcome of ['success', 'failure'] as const) {
    test(`Given ${stop} leaves DNS pending, when calls repeat before late DNS ${lateOutcome}, then no additional lookup starts and the fetcher recovers after native settlement`, async (t) => {
      const pending = pendingDns(t);
      const rejected = assert.rejects(pending.result);
      if (stop === 'cancellation') pending.controller.abort();
      else t.mock.timers.tick(5_000);
      await rejected;

      for (let attempt = 0; attempt < 20; attempt += 1) {
        const retry = new AbortController();
        let failure: unknown;
        const finished = pending.fetcher.fetchURL(`https://retry-${attempt}.test/`, retry.signal)
          .then(() => {}, (error: unknown) => { failure = error; });
        try {
          await setImmediate();
          assert.equal(pending.lookup.mock.callCount(), 1, 'An abandoned native lookup must prevent additional DNS work');
          assert.ok(failure instanceof Error);
          assert.match(failure.message, /previous DNS lookup is still pending/);
          assert.equal(getEventListeners(retry.signal, 'abort').length, 0);
        } finally {
          retry.abort();
          await finished;
        }
      }
      if (lateOutcome === 'success') pending.answer.resolve([{ address: '1.1.1.1', family: 4 }]);
      else pending.answer.reject(new Error('Late DNS failure'));
      await setImmediate();
      assert.equal(pending.renderer.execute.mock.callCount(), 0);

      pending.lookup.mock.mockImplementation(async () => [{ address: '1.1.1.1', family: 4 }]);
      const recovered = pending.fetcher.fetchURL('https://recovered.test/');
      await pending.renderer.launched;
      pending.renderer.finish(null, JSON.stringify({ url: 'https://recovered.test/', http_status: 200, content: '<p>Recovered</p>', error: null }), '');
      assert.equal((await recovered).html, '<p>Recovered</p>');
      assert.equal(pending.lookup.mock.callCount(), 2);
    });
  }
}

test('Given one fetcher has abandoned DNS, when an address literal or a separate fetcher is used, then both can render', async (t) => {
  const pending = pendingDns(t);
  const rejected = assert.rejects(pending.result);
  pending.controller.abort();
  await rejected;

  const literal = pending.fetcher.fetchURL('https://1.1.1.1/');
  await pending.renderer.launched;
  pending.renderer.finish(null, JSON.stringify({ url: 'https://1.1.1.1/', http_status: 200, content: '<p>Literal</p>', error: null }), '');
  assert.equal((await literal).html, '<p>Literal</p>');
  assert.equal(pending.lookup.mock.callCount(), 1);

  pending.lookup.mock.mockImplementation(async () => [{ address: '1.1.1.1', family: 4 }]);
  const other = new WebsiteFetcherLightpanda().fetchURL('https://other.test/');
  await setImmediate();
  assert.equal(pending.lookup.mock.callCount(), 2);
  pending.renderer.finish(null, JSON.stringify({ url: 'https://other.test/', http_status: 200, content: '<p>Other</p>', error: null }), '');
  assert.equal((await other).html, '<p>Other</p>');
});

test('Given pending DNS is cancelled, when another call starts before the cancellation continuation, then no additional lookup starts', async (t) => {
  const pending = pendingDns(t);
  const rejected = assert.rejects(pending.result);
  pending.controller.abort();
  await assert.rejects(pending.fetcher.fetchURL('https://retry.test/'), /previous DNS lookup is still pending/);
  await rejected;
  assert.equal(pending.lookup.mock.callCount(), 1);
});

test('Given two normal concurrent lookups are cancelled, when only one native lookup settles, then further DNS work stays refused', async (t) => {
  const pending = pendingDns(t);
  const otherAnswer = Promise.withResolvers<Array<{ address: string; family: number }>>();
  pending.lookup.mock.mockImplementation(() => otherAnswer.promise);
  const other = new AbortController();
  const firstRejected = assert.rejects(pending.result);
  const secondRejected = assert.rejects(pending.fetcher.fetchURL('https://other.test/', other.signal));
  assert.equal(pending.lookup.mock.callCount(), 2);
  pending.controller.abort();
  other.abort();
  await Promise.all([firstRejected, secondRejected]);
  pending.answer.resolve([{ address: '1.1.1.1', family: 4 }]);
  await setImmediate();
  await assert.rejects(pending.fetcher.fetchURL('https://retry.test/'), /previous DNS lookup is still pending/);
  assert.equal(pending.lookup.mock.callCount(), 2);
  otherAnswer.reject(new Error('Late DNS failure'));
  await setImmediate();
  pending.lookup.mock.mockImplementation(async () => { throw new Error('Fresh DNS lookup'); });
  await assert.rejects(pending.fetcher.fetchURL('https://retry.test/'), /Fresh DNS lookup/);
  assert.equal(pending.lookup.mock.callCount(), 3);
  assert.equal(pending.renderer.execute.mock.callCount(), 0);
});
