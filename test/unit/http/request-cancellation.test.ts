import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import { waitForRequest } from '../../../src/runtime/http/request-cancellation.ts';

test('Given cancellation before a request stage, when the wait starts, then it refuses without starting that stage', async () => {
  const stop = new AbortController();
  stop.abort(new Error('request stopped'));
  let started = false;
  assert.throws(() => waitForRequest(stop.signal, async () => { started = true; }), /request stopped/);
  assert.equal(started, false);
});

test('Given an identity call without cancellation support, when the request stops, then its wait rejects before the call settles and its later rejection is observed', async () => {
  const stop = new AbortController();
  const work = Promise.withResolvers<void>();
  const pending = waitForRequest(stop.signal, () => work.promise);
  const rejected = assert.rejects(pending, /request stopped/);
  stop.abort(new Error('request stopped'));
  await rejected;
  work.reject(new Error('late identity failure'));
  await setImmediate();
});
