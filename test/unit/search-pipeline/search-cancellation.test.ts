import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isSearchCancelled, throwIfSearchCancelled } from '../../../src/search-pipeline/search-cancellation.ts';

for (const error of [undefined, null, 'AbortError', { name: 'AbortError' }, new Error('private failure')]) {
  test('Given no cancelled signal or Error, when cancellation is checked, then ordinary failures remain failures', () => {
    assert.equal(isSearchCancelled(new AbortController().signal, error), false);
  });
}

for (const error of [new DOMException('private abort', 'AbortError'), Object.assign(new Error('private abort'), { name: 'AbortError' })]) {
  test('Given a real AbortError without an aborted signal, when checked, then cancellation has fixed text and no cause', () => {
    const signal = new AbortController().signal;
    assert.equal(isSearchCancelled(signal, error), true);
    assert.throws(() => throwIfSearchCancelled(signal, error), (failure: Error) => {
      assert.equal(failure.name, 'AbortError');
      assert.equal(failure.message, 'Request cancelled');
      assert.equal(failure.cause, undefined);
      return true;
    });
  });
}

test('Given an unreadable error name, when checked, then the name is read once and failure remains local', () => {
  let reads = 0;
  const error = Object.defineProperty(new Error('private failure'), 'name', { get() { reads++; throw new Error('private getter'); } });
  assert.equal(isSearchCancelled(new AbortController().signal, error), false);
  assert.equal(reads, 1);
});

test('Given an aborted signal and a hostile error proxy, when checked, then neither error properties nor its prototype are inspected', () => {
  const controller = new AbortController();
  controller.abort('private reason');
  let inspections = 0;
  const error = new Proxy(new Error('private failure'), {
    get() { inspections++; throw new Error('private property'); },
    getPrototypeOf() { inspections++; throw new Error('private prototype'); },
  });
  assert.equal(isSearchCancelled(controller.signal, error), true);
  assert.equal(inspections, 0);
});

for (const throws of [false, true]) {
  test(`Given a name getter aborts and throws ${throws}, when checked, then the new cancellation wins after one read`, () => {
    const controller = new AbortController();
    let reads = 0;
    const error = Object.defineProperty(new Error('private failure'), 'name', { get() {
      reads++;
      controller.abort('private reason');
      if (throws) throw new Error('private getter');
      return 'OtherError';
    } });
    assert.equal(isSearchCancelled(controller.signal, error), true);
    assert.equal(reads, 1);
  });
}

for (const cancel of [false, true]) {
  test(`Given a throwing prototype trap with cancellation ${cancel}, when checked, then one bounded inspection preserves the signal decision`, () => {
    const controller = new AbortController();
    let inspections = 0;
    const error = new Proxy(new Error('private failure'), { getPrototypeOf() {
      inspections++;
      if (cancel) controller.abort('private reason');
      throw new Error('private prototype');
    } });
    assert.equal(isSearchCancelled(controller.signal, error), cancel);
    assert.equal(inspections, 1);
  });
}

test('Given a live signal and no error, when a checkpoint runs, then search can continue', () => {
  assert.doesNotThrow(() => throwIfSearchCancelled(new AbortController().signal));
});
