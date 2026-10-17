import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { OperatorLogSpy } from '../../support/doubles/application/operator-log-spy.ts';

describe('Operator log spy that stands in for the application logger', () => {
  test('Given a new spy, when info and error are called in turn, then the lines have the INFO and ERROR lines in the order of the calls', () => {
    const spy = new OperatorLogSpy();

    spy.info('Thermus started');
    spy.error('An account request failed');
    spy.info('Account change record: {}');

    assert.deepEqual(spy.lines, ['INFO Thermus started', 'ERROR An account request failed', 'INFO Account change record: {}']);
  });

  test('Given info and error taken off the spy, when they are called without the spy, then the lines still go to that spy', () => {
    const spy = new OperatorLogSpy();
    const { info, error } = spy;

    info('first');
    error('second');

    assert.deepEqual(spy.lines, ['INFO first', 'ERROR second']);
  });

  test('Given two new spies, when each gets one line, then each spy has only its own line', () => {
    const first = new OperatorLogSpy();
    const second = new OperatorLogSpy();

    first.info('one');
    second.error('two');

    assert.deepEqual([first.lines, second.lines], [['INFO one'], ['ERROR two']]);
  });
});
