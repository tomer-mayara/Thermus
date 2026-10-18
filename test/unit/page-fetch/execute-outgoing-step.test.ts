import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { test, type TestContext } from 'node:test';
import { executeOutgoingStep } from '../../../src/page-fetch/execute-outgoing-step.ts';
import type { PipelineStep, StepResult } from '../../../src/page-fetch/pipeline-step.ts';
import type { StepRecord } from '../../../src/page-fetch/step-record.ts';
import { executionContextOf } from '../../support/fixtures/execution-context.ts';

const url = 'HTTPS://Source.Example/private-path?private-query#private-fragment';

function fixture(t: TestContext, result: unknown = { decision: 'allow', output: url }) {
  const entries: StepRecord[] = [];
  const execute = t.mock.fn(async (_input: string, _signal: AbortSignal) => result as StepResult<string, 'blocked'>);
  const record = t.mock.fn((entry: StepRecord) => { entries.push(entry); });
  const outgoing: PipelineStep<string, string, 'blocked'> = { execute };
  return { outgoing, execute, records: { record }, entries };
}

test('Given an allowed exact URL and a trusted execution, when the outgoing executor runs, then it passes only input and the same signal and writes one fixed allowed record', async (t) => {
  const dependencies = fixture(t);
  const execution = executionContextOf();
  t.mock.method(performance, 'now', () => 17);

  assert.equal(await executeOutgoingStep(url, execution, dependencies), url);

  assert.equal(dependencies.execute.mock.callCount(), 1);
  assert.equal(dependencies.execute.mock.calls[0].arguments[0], url);
  assert.equal(dependencies.execute.mock.calls[0].arguments[1], execution.signal);
  assert.equal(dependencies.execute.mock.calls[0].arguments.length, 2);
  assert.deepEqual(dependencies.entries, [{ event: 'pipeline.step.completed', operationId: execution.operationId,
    stepId: 'outgoing.observe_request', outcome: 'allowed', durationMs: 0 }]);
});

const rejectedResults = [
  ['block', { decision: 'block', code: 'blocked' }, 'blocked', 'blocked'],
  ['scan failure in outgoing', { decision: 'block', code: 'scan_failed' }, 'failed', 'invalid_step_result'],
  ['scan limit in outgoing', { decision: 'block', code: 'scan_limit' }, 'failed', 'invalid_step_result'],
  ['unknown code', { decision: 'block', code: 'private-code' }, 'failed', 'invalid_step_result'],
  ['missing code', { decision: 'block' }, 'failed', 'invalid_step_result'],
  ['block with output', { decision: 'block', code: 'blocked', output: 'private-output' }, 'failed', 'invalid_step_result'],
  ['block with undefined output', { decision: 'block', code: 'blocked', output: undefined }, 'failed', 'invalid_step_result'],
  ['unknown decision', { decision: 'step_up', output: url }, 'failed', 'invalid_step_result'],
  ['missing output', { decision: 'allow' }, 'failed', 'invalid_step_result'],
  ['changed URL', { decision: 'allow', output: 'https://private-exfiltration.example/' }, 'failed', 'invalid_step_result'],
  ['nonstring output', { decision: 'allow', output: 4 }, 'failed', 'invalid_step_result'],
  ['allow with code', { decision: 'allow', output: url, code: undefined }, 'failed', 'invalid_step_result'],
  ['null', null, 'failed', 'invalid_step_result'],
  ['undefined', undefined, 'failed', 'invalid_step_result'],
  ['array', [], 'failed', 'invalid_step_result'],
  ['string', 'private-result', 'failed', 'invalid_step_result'],
  ['inherited result fields', Object.create({ decision: 'allow', output: url }), 'failed', 'invalid_step_result'],
] as const;

for (const [name, result, outcome, code] of rejectedResults) {
  test(`Given ${name}, when the outgoing step settles, then it fails closed with one ${outcome} record and no raw result`, async (t) => {
    const dependencies = fixture(t, result);
    if (result === undefined) dependencies.execute.mock.mockImplementation(async () => undefined as unknown as StepResult<string, 'blocked'>);
    const execution = executionContextOf();
    t.mock.method(performance, 'now', () => 0);

    await assert.rejects(executeOutgoingStep(url, execution, dependencies), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, 'Page fetch failed');
      assert.equal(error.cause, undefined);
      return true;
    });

    assert.equal(dependencies.execute.mock.callCount(), 1);
    assert.deepEqual(dependencies.entries, [{ event: 'pipeline.step.completed', operationId: execution.operationId,
      stepId: 'outgoing.observe_request', outcome, code, durationMs: 0 }]);
    assert.doesNotMatch(JSON.stringify(dependencies.entries), /private-|Source|exfiltration/);
  });
}

test('Given a throwing step, when it settles, then one fixed failure record and safe fetch error replace the raw cause', async (t) => {
  const dependencies = fixture(t);
  dependencies.execute.mock.mockImplementation(() => { throw new Error('private-error Bearer private-token'); });
  const execution = executionContextOf();
  t.mock.method(performance, 'now', () => 0);

  await assert.rejects(executeOutgoingStep(url, execution, dependencies), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.message, 'Page fetch failed');
    assert.equal(error.cause, undefined);
    return true;
  });

  assert.deepEqual(dependencies.entries, [{ event: 'pipeline.step.completed', operationId: execution.operationId,
    stepId: 'outgoing.observe_request', outcome: 'failed', code: 'step_failed', durationMs: 0 }]);
});

for (const result of [{ decision: 'allow', output: url }, { decision: 'block', code: 'scan_failed' }]) {
  test(`Given an incoming ID supplied by an outgoing step with ${result.decision}, when it runs, then the trusted outgoing binding controls its record and code rules`, async (t) => {
    const dependencies = fixture(t, result);
    Object.defineProperty(dependencies.outgoing, 'id', { get: () => { throw new Error('The executor must not read the supplied ID'); } });
    if (result.decision === 'allow') assert.equal(await executeOutgoingStep(url, executionContextOf(), dependencies), url);
    else await assert.rejects(executeOutgoingStep(url, executionContextOf(), dependencies), { message: 'Page fetch failed' });
    assert.equal(dependencies.entries.length, 1);
    assert.equal(dependencies.entries[0].stepId, 'outgoing.observe_request');
    assert.equal(dependencies.entries[0].outcome, result.decision === 'allow' ? 'allowed' : 'failed');
  });
}

test('Given allowed result getters that change on a second read, when validated, then the first decision and output are used once for both release and record', async (t) => {
  const reads = { decision: 0, output: 0 };
  const dependencies = fixture(t, {
    get decision() { return ++reads.decision === 1 ? 'allow' : 'block'; },
    get output() { return ++reads.output === 1 ? url : 'private-changed-output'; },
  });

  assert.equal(await executeOutgoingStep(url, executionContextOf(), dependencies), url);

  assert.deepEqual(reads, { decision: 1, output: 1 });
  assert.equal(dependencies.entries[0].outcome, 'allowed');
});

test('Given a block code getter that changes on a second read, when validated, then the captured permitted code is recorded once', async (t) => {
  let reads = 0;
  const dependencies = fixture(t, { decision: 'block', get code() { return ++reads === 1 ? 'blocked' : 'scan_failed'; } });

  await assert.rejects(executeOutgoingStep(url, executionContextOf(), dependencies), { message: 'Page fetch failed' });

  assert.equal(reads, 1);
  assert.equal(dependencies.entries[0].outcome, 'blocked');
  assert.equal('code' in dependencies.entries[0] && dependencies.entries[0].code, 'blocked');
});

for (const [name, started, ended, durationMs] of [
  ['round down', 1, 1.49, 0], ['round up', 1, 1.5, 1], ['negative', 2, 1, 0],
  ['NaN start', NaN, 2, 0], ['NaN end', 1, NaN, 0], ['infinite start', Infinity, 2, 0],
  ['infinite end', 1, Infinity, 0], ['negative infinity', -Infinity, 2, 0],
  ['above safe integer', 0, Number.MAX_SAFE_INTEGER * 2, Number.MAX_SAFE_INTEGER],
  ['finite subtraction overflow', -Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_SAFE_INTEGER],
] as const) {
  test(`Given ${name} clock values, when a step is recorded, then the duration is a bounded nonnegative integer`, async (t) => {
    const dependencies = fixture(t);
    const ticks = [started, ended];
    t.mock.method(performance, 'now', () => ticks.shift());

    assert.equal(await executeOutgoingStep(url, executionContextOf(), dependencies), url);

    assert.equal(dependencies.entries.length, 1);
    assert.equal(dependencies.entries[0].durationMs, durationMs);
    assert.ok(Number.isSafeInteger(dependencies.entries[0].durationMs));
  });
}

for (const outcome of ['allow', 'block', 'throw'] as const) {
  test(`Given ${outcome} and a sink that throws, when the executor settles, then its result holds with one execution and one write attempt`, async (t) => {
    const dependencies = fixture(t, outcome === 'block' ? { decision: 'block', code: 'blocked' } : { decision: 'allow', output: url });
    if (outcome === 'throw') dependencies.execute.mock.mockImplementation(async () => { throw new Error('private-step-error'); });
    dependencies.records.record.mock.mockImplementation(() => { throw new Error('private-sink-error'); });

    if (outcome === 'allow') assert.equal(await executeOutgoingStep(url, executionContextOf(), dependencies), url);
    else await assert.rejects(executeOutgoingStep(url, executionContextOf(), dependencies), { message: 'Page fetch failed' });

    assert.equal(dependencies.execute.mock.callCount(), 1);
    assert.equal(dependencies.records.record.mock.callCount(), 1);
  });
}

test('Given cancellation before entry, when the executor is called, then neither the step nor its record starts', async (t) => {
  const dependencies = fixture(t);
  const controller = new AbortController();
  controller.abort(new Error('private-abort-reason'));

  await assert.rejects(executeOutgoingStep(url, executionContextOf(controller.signal), dependencies), { name: 'AbortError', message: 'Request cancelled' });

  assert.equal(dependencies.execute.mock.callCount(), 0);
  assert.deepEqual(dependencies.entries, []);
});

for (const outcome of ['allow', 'block', 'invalid', 'throw'] as const) {
  test(`Given cancellation during a step with late ${outcome}, when owned cleanup has not settled, then no record or result occurs; after settlement one cancellation wins`, async (t) => {
    const dependencies = fixture(t);
    const release = Promise.withResolvers<void>();
    t.after(() => release.resolve());
    dependencies.execute.mock.mockImplementation(async () => {
      await release.promise;
      if (outcome === 'throw') throw new Error('private-step-error');
      return (outcome === 'allow' ? { decision: 'allow', output: url } : { decision: 'block', code: outcome === 'block' ? 'blocked' : 'scan_failed' }) as StepResult<string, 'blocked'>;
    });
    const controller = new AbortController();
    const execution = executionContextOf(controller.signal);
    let settled = false;
    const pending = executeOutgoingStep(url, execution, dependencies).then(
      (value) => { settled = true; return value; },
      (error: unknown) => { settled = true; return error; },
    );
    controller.abort(new Error('private-abort-reason'));
    await setImmediate();
    assert.equal(settled, false);
    assert.equal(dependencies.entries.length, 0);

    release.resolve();
    const error = await pending;
    assert.ok(error instanceof DOMException);
    assert.equal(error.name, 'AbortError');
    assert.equal(error.message, 'Request cancelled');

    assert.equal(dependencies.entries.length, 1);
    assert.equal(dependencies.entries[0].outcome, 'cancelled');
    assert.equal('code' in dependencies.entries[0] && dependencies.entries[0].code, 'cancelled');
    assert.doesNotMatch(JSON.stringify(dependencies.entries), /private-/);
  });
}

test('Given a collaborator AbortError before the signal changes, when handled even with a broken sink, then safe cancellation wins and is recorded once', async (t) => {
  const dependencies = fixture(t);
  const execution = executionContextOf();
  dependencies.execute.mock.mockImplementation(async () => { throw new DOMException('private-cause', 'AbortError'); });
  dependencies.records.record.mock.mockImplementation(() => { throw new Error('private-sink-error'); });

  await assert.rejects(executeOutgoingStep(url, execution, dependencies), { name: 'AbortError', message: 'Request cancelled' });

  assert.equal(execution.signal.aborted, false);
  assert.equal(dependencies.records.record.mock.callCount(), 1);
  assert.equal(dependencies.records.record.mock.calls[0].arguments[0].outcome, 'cancelled');
});

test('Given an allowed output accessor that aborts the request, when validation reads it, then cancellation is recorded before any allowed result', async (t) => {
  const controller = new AbortController();
  const dependencies = fixture(t, { decision: 'allow', get output() { controller.abort(); return url; } });

  await assert.rejects(executeOutgoingStep(url, executionContextOf(controller.signal), dependencies), { name: 'AbortError', message: 'Request cancelled' });

  assert.equal(dependencies.entries.length, 1);
  assert.equal(dependencies.entries[0].outcome, 'cancelled');
});
