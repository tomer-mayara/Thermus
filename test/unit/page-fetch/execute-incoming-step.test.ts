import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { test, type TestContext } from 'node:test';
import { executeIncomingStep } from '../../../src/page-fetch/execute-incoming-step.ts';
import type { PipelineStep, StepResult } from '../../../src/page-fetch/pipeline-step.ts';
import { writeStepRecord, type StepRecord } from '../../../src/page-fetch/step-record.ts';
import type { WebsiteFetchResult } from '../../../src/website-fetcher/website-fetcher.ts';
import { executionContextOf } from '../../support/fixtures/execution-context.ts';

const page = { requestedUrl: 'HTTPS://Source.Example/private-path', finalUrl: 'https://private-target.example/', html: '<p>private-html</p>' };

function fixture(t: TestContext, result: unknown) {
  const entries: StepRecord[] = [];
  const execute = t.mock.fn(async (_page: WebsiteFetchResult, _signal: AbortSignal) => result as StepResult<string>);
  const record = t.mock.fn((entry: StepRecord) => { entries.push(entry); });
  const incoming: PipelineStep<WebsiteFetchResult, string> = { execute };
  return { incoming, execute, records: { record }, entries };
}

for (const output of ['private-markdown\n', '']) {
  test(`Given ${output ? 'exact' : 'empty'} incoming Markdown, when the trusted role executes, then one safe record follows exact release with the same page and signal`, async (t) => {
    const dependencies = fixture(t, { decision: 'allow', output });
    const execution = executionContextOf();
    t.mock.method(performance, 'now', () => 10);
    Object.defineProperty(dependencies.incoming, 'id', { get: () => { throw new Error('Do not read the untrusted ID'); } });

    assert.deepEqual(await executeIncomingStep(page, execution, dependencies), { status: 'released', markdown: output });

    assert.equal(dependencies.execute.mock.callCount(), 1);
    assert.deepEqual(dependencies.execute.mock.calls[0].arguments, [page, execution.signal]);
    assert.equal(dependencies.execute.mock.calls[0].arguments[0], page);
    assert.deepEqual(dependencies.entries, [{ event: 'pipeline.step.completed', operationId: execution.operationId,
      stepId: 'incoming.process_html', outcome: 'allowed', durationMs: 0 }]);
  });
}

for (const code of ['scan_failed', 'scan_limit'] as const) {
  test(`Given incoming ${code}, when the step settles, then the typed withheld outcome contains no payload and one fixed blocked record`, async (t) => {
    const dependencies = fixture(t, { decision: 'block', code, id: 'outgoing.observe_request', warnings: 'private-warning' });
    const execution = executionContextOf();
    t.mock.method(performance, 'now', () => 0);

    assert.deepEqual(await executeIncomingStep(page, execution, dependencies), { status: 'withheld', code });

    assert.deepEqual(dependencies.entries, [{ event: 'pipeline.step.completed', operationId: execution.operationId,
      stepId: 'incoming.process_html', outcome: 'blocked', code, durationMs: 0 }]);
    assert.doesNotMatch(JSON.stringify(dependencies.entries), /private-|Source/);
  });
}

for (const [name, result] of [
  ['generic block', { decision: 'block', code: 'blocked' }],
  ['unknown code', { decision: 'block', code: 'private-code' }],
  ['missing code', { decision: 'block' }],
  ['block with payload', { decision: 'block', code: 'scan_failed', output: 'private-payload' }],
  ['block with undefined payload', { decision: 'block', code: 'scan_limit', output: undefined }],
  ['unknown decision', { decision: 'private-decision' }],
  ['missing output', { decision: 'allow' }],
  ['nonstring output', { decision: 'allow', output: 42 }],
  ['allow with code', { decision: 'allow', output: 'private-payload', code: undefined }],
  ['null', null], ['undefined', undefined], ['array', []], ['string', 'private-result'],
  ['inherited decision', Object.assign(Object.create({ decision: 'allow' }), { output: 'private-payload' })],
  ['inherited output', Object.assign(Object.create({ output: 'private-payload' }), { decision: 'allow' })],
  ['inherited code', Object.assign(Object.create({ code: 'scan_failed' }), { decision: 'block' })],
] as const) {
  test(`Given incoming ${name}, when validated, then a fixed processing error replaces the result and one terminal record excludes all private data`, async (t) => {
    const dependencies = fixture(t, result);
    const execution = executionContextOf();
    t.mock.method(performance, 'now', () => 0);

    await assert.rejects(executeIncomingStep(page, execution, dependencies), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, 'Page processing failed');
      assert.equal(error.cause, undefined);
      return true;
    });

    assert.equal(dependencies.execute.mock.callCount(), 1);
    assert.deepEqual(dependencies.entries, [{ event: 'pipeline.step.completed', operationId: execution.operationId,
      stepId: 'incoming.process_html', outcome: name === 'generic block' ? 'blocked' : 'failed',
      code: name === 'generic block' ? 'blocked' : 'invalid_step_result', durationMs: 0 }]);
    assert.doesNotMatch(JSON.stringify(dependencies.entries), /private-|Source/);
  });
}

for (const code of [undefined, 'scan_limit'] as const) {
  test(`Given changing result getters for ${code ?? 'allow'}, when validation reads them, then release and record use one captured result`, async (t) => {
    const reads = { decision: 0, output: 0, code: 0 };
    const result = code ? { decision: 'block', get code() { reads.code += 1; return reads.code === 1 ? code : 'private-code'; } }
      : { get decision() { reads.decision += 1; return reads.decision === 1 ? 'allow' : 'block'; },
        get output() { reads.output += 1; return reads.output === 1 ? 'Exact Markdown' : 42; } };
    const dependencies = fixture(t, result);

    assert.deepEqual(await executeIncomingStep(page, executionContextOf(), dependencies), code ? { status: 'withheld', code } : { status: 'released', markdown: 'Exact Markdown' });
    assert.deepEqual(reads, code ? { decision: 0, output: 0, code: 1 } : { decision: 1, output: 1, code: 0 });
  });
}

for (const outcome of ['allow', 'block', 'throw'] as const) {
  test(`Given incoming ${outcome} and a broken sink, when it settles, then one write attempt cannot repeat or change the work`, async (t) => {
    const dependencies = fixture(t, outcome === 'block' ? { decision: 'block', code: 'scan_failed' } : { decision: 'allow', output: 'Exact Markdown' });
    if (outcome === 'throw') dependencies.execute.mock.mockImplementation(async () => { throw new Error('private-step-error'); });
    dependencies.records.record.mock.mockImplementation(() => { throw new Error('private-sink-error'); });

    if (outcome === 'throw') await assert.rejects(executeIncomingStep(page, executionContextOf(), dependencies), { message: 'Page processing failed' });
    else assert.deepEqual(await executeIncomingStep(page, executionContextOf(), dependencies), outcome === 'block'
      ? { status: 'withheld', code: 'scan_failed' } : { status: 'released', markdown: 'Exact Markdown' });
    assert.equal(dependencies.execute.mock.callCount(), 1);
    assert.equal(dependencies.records.record.mock.callCount(), 1);
    assert.equal(dependencies.records.record.mock.calls[0].arguments[0].outcome, outcome === 'throw' ? 'failed' : outcome === 'block' ? 'blocked' : 'allowed');
  });
}

test('Given cancellation before incoming entry, when called, then no step or record starts', async (t) => {
  const dependencies = fixture(t, { decision: 'allow', output: 'private-payload' });
  const controller = new AbortController();
  controller.abort();

  await assert.rejects(executeIncomingStep(page, executionContextOf(controller.signal), dependencies), { name: 'AbortError', message: 'Request cancelled' });
  assert.equal(dependencies.execute.mock.callCount(), 0);
  assert.deepEqual(dependencies.entries, []);
});

for (const outcome of ['allow', 'block', 'invalid', 'throw'] as const) {
  test(`Given cancelled incoming work with late ${outcome}, when cleanup is pending, then neither result nor record settles until cleanup and one cancellation wins`, async (t) => {
    const dependencies = fixture(t, undefined);
    const release = Promise.withResolvers<void>();
    t.after(() => release.resolve());
    dependencies.execute.mock.mockImplementation(async () => {
      await release.promise;
      if (outcome === 'throw') throw new Error('private-late-error');
      return (outcome === 'allow' ? { decision: 'allow', output: 'private-payload' }
        : { decision: 'block', code: outcome === 'block' ? 'scan_limit' : 'private-code' }) as StepResult<string>;
    });
    const controller = new AbortController();
    let settled = false;
    const pending = executeIncomingStep(page, executionContextOf(controller.signal), dependencies).catch((error: unknown) => { settled = true; return error; });
    controller.abort();
    await setImmediate();
    assert.equal(settled, false);
    assert.equal(dependencies.entries.length, 0);
    release.resolve();
    const error = await pending;
    assert.ok(error instanceof DOMException);
    assert.equal(error.name, 'AbortError');
    assert.equal(dependencies.entries.length, 1);
    assert.equal(dependencies.entries[0].outcome, 'cancelled');
  });
}

test('Given a collaborator AbortError with no signal change, when incoming work rejects, then one cancellation record and fixed cancellation replace its private cause', async (t) => {
  const dependencies = fixture(t, undefined);
  const execution = executionContextOf();
  dependencies.execute.mock.mockImplementation(async () => { throw new DOMException('private-abort-cause', 'AbortError'); });

  await assert.rejects(executeIncomingStep(page, execution, dependencies), { name: 'AbortError', message: 'Request cancelled' });

  assert.equal(execution.signal.aborted, false);
  assert.equal(dependencies.entries.length, 1);
  assert.equal(dependencies.entries[0].outcome, 'cancelled');
});

for (const stepId of ['incoming.process_html', 'search.incoming.process_html'] as const) {
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
