import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeApplication } from '../../src/app/application.ts';

test('Given active MCP work and a listener that is draining, when concurrent close calls start, then work closes before drain and providers wait for both', async () => {
  const events: string[] = [];
  const work = Promise.withResolvers<void>();
  const listener = Promise.withResolvers<void>();
  const providers = new AsyncDisposableStack();
  providers.defer(() => { events.push('provider'); });
  const application = composeApplication(async () => new Response(), {
    close: () => { events.push('work'); return work.promise; },
  }, providers);

  const closing = application.close(listener.promise);
  assert.equal(application.close(), closing);
  assert.deepEqual(events, ['work']);
  work.resolve();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(events, ['work']);
  listener.resolve();
  await closing;

  assert.equal(application.close(), closing);
  await application.close();
  assert.deepEqual(events, ['work', 'provider']);
});

test('Given a drained listener and active MCP cleanup, when the application closes, then providers wait for that cleanup', async () => {
  const work = Promise.withResolvers<void>();
  let providerCloses = 0;
  const providers = new AsyncDisposableStack();
  providers.defer(() => { providerCloses++; });
  const application = composeApplication(async () => new Response(), { close: () => work.promise }, providers);

  const closing = application.close(Promise.resolve());
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(providerCloses, 0);
  work.resolve();
  await closing;

  assert.equal(providerCloses, 1);
});

test('Given cleanup failures in MCP, listener, and providers, when close is called repeatedly, then every resource closes once and every failure remains visible', async () => {
  const work = Promise.withResolvers<void>();
  const workFailure = new Error('MCP cleanup failed');
  const listenerFailure = new Error('Listener cleanup failed');
  const providerFailure = new Error('Provider cleanup failed');
  let workCloses = 0;
  let providerCloses = 0;
  const providers = new AsyncDisposableStack();
  providers.defer(() => { providerCloses++; throw providerFailure; });
  const application = composeApplication(async () => new Response(), {
    close: () => { workCloses++; return work.promise; },
  }, providers);

  const closing = application.close(Promise.reject(listenerFailure));
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(providerCloses, 0);
  const rejected = assert.rejects(closing, (error) => {
    assert.ok(error instanceof SuppressedError);
    assert.equal(error.error, providerFailure);
    assert.ok(error.suppressed instanceof SuppressedError);
    assert.equal(error.suppressed.error, listenerFailure);
    assert.equal(error.suppressed.suppressed, workFailure);
    return true;
  });
  work.reject(workFailure);
  await rejected;

  assert.equal(application.close(), closing);
  await assert.rejects(application.close());
  assert.deepEqual({ workCloses, providerCloses }, { workCloses: 1, providerCloses: 1 });
});
