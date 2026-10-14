import assert from 'node:assert/strict';
import { test } from 'node:test';
import { failureMessage } from '../../../src/logging/failure-message.ts';

const plainFailures: ReadonlyArray<{ kind: string; failure: unknown; message: string }> = [
  { kind: 'an Error', failure: new Error('The listen port is in use.'), message: 'The listen port is in use.' },
  { kind: 'a string', failure: 'renderer stopped', message: 'renderer stopped' },
  { kind: 'a number', failure: 42, message: '42' },
];
for (const { kind, failure, message } of plainFailures) {
  test(`Given ${kind}, when the failure message is made, then it is ${JSON.stringify(message)}`, () => {
    assert.equal(failureMessage(failure), message);
  });
}

test('Given a SuppressedError of a cleanup failure after a startup failure, when the failure message is made, then it gives the startup failure and then the cleanup failure', () => {
  const failure = new SuppressedError(new Error('MCP cleanup failed'), new Error('The startup log failed'));

  assert.equal(failureMessage(failure), 'The startup log failed The cleanup after this failure also failed: MCP cleanup failed');
});

test('Given the nested SuppressedError of two cleanup failures after a startup failure, when the failure message is made, then it gives the three failures in the order they occurred', () => {
  const first = new SuppressedError(new Error('MCP cleanup failed'), new Error('The startup log failed'));
  const failure = new SuppressedError(new Error('Listener cleanup failed'), first);

  assert.equal(failureMessage(failure), 'The startup log failed The cleanup after this failure also failed: MCP cleanup failed'
    + ' The cleanup after this failure also failed: Listener cleanup failed');
});
