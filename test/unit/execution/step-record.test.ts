import assert from 'node:assert/strict';
import { test } from 'node:test';
import { writeStepRecord, type StepRecord } from '../../../src/pipelines/execution/step-record.ts';
import { executionContextOf } from '../../support/fixtures/execution-context.ts';

for (const stepId of ['outgoing.observe_request', 'incoming.process_html', 'search.outgoing.observe_request', 'search.incoming.process_html'] as const) {
  test(`Given shared ${stepId} metadata, when the record writer runs, then it preserves the finite ID and safe outcome`, (t) => {
    const entries: StepRecord[] = [];
    const execution = executionContextOf();
    t.mock.method(performance, 'now', () => 10);

    writeStepRecord({ record: (entry) => { entries.push(entry); } }, {
      operationId: execution.operationId, stepId, outcome: 'allowed',
    }, 0);

    assert.deepEqual(entries, [{ event: 'pipeline.step.completed', operationId: execution.operationId,
      stepId, outcome: 'allowed', durationMs: 10 }]);
  });
}

for (const [name, started, ended, durationMs] of [
  ['round down', 1, 1.49, 0], ['round up', 1, 1.5, 1], ['negative', 2, 1, 0],
  ['NaN start', NaN, 2, 0], ['NaN end', 1, NaN, 0], ['infinite start', Infinity, 2, 0],
  ['infinite end', 1, Infinity, 0], ['negative infinity', -Infinity, 2, 0],
  ['above safe integer', 0, Number.MAX_SAFE_INTEGER * 2, Number.MAX_SAFE_INTEGER],
  ['finite subtraction overflow', -Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_SAFE_INTEGER],
] as const) {
  test(`Given ${name} clock values, when a step is recorded, then the duration is a bounded nonnegative integer`, (t) => {
    const entries: StepRecord[] = [];
    t.mock.method(performance, 'now', () => ended);

    writeStepRecord({ record: (entry) => { entries.push(entry); } }, {
      operationId: executionContextOf().operationId, stepId: 'outgoing.observe_request', outcome: 'allowed',
    }, started);

    assert.equal(entries.length, 1);
    assert.equal(entries[0].durationMs, durationMs);
    assert.ok(Number.isSafeInteger(entries[0].durationMs));
  });
}
