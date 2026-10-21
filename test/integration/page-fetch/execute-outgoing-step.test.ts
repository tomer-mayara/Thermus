import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { test, type TestContext } from 'node:test';
import { createFetchPage } from '../../../src/pipelines/page-fetch/fetch-page.ts';
import { createRequestContext } from '../../../src/accounts/identity/access-context.ts';
import type { ExecutionContext } from '../../../src/pipelines/execution/execution-context.ts';
import type { PipelineStep, StepResult } from '../../../src/pipelines/execution/pipeline-step.ts';
import type { StepRecord } from '../../../src/pipelines/execution/step-record.ts';
import { executionContextOf } from '../../support/fixtures/execution-context.ts';

const url = 'HTTPS://Source.Example/private-path?private-query#private-fragment';

const context = createRequestContext({
  user: { authority: 'https://synthetic.example/', subject: 'synthetic-user' },
  tenantId: 'synthetic-workspace',
  grants: [{ role: 'reader', permissions: ['product:access'] }],
});

function fixture(t: TestContext, result: unknown = { decision: 'allow', output: url }) {
  const allEntries: StepRecord[] = [];
  const execute = t.mock.fn(async (_input: string, _signal: AbortSignal) => result as StepResult<string, 'blocked'>);
  const record = t.mock.fn((entry: StepRecord) => { allEntries.push(entry); });
  const outgoing: PipelineStep<string, string, 'blocked'> = { execute };
  const fetchURL = t.mock.fn(async (_url: string, _signal?: AbortSignal) => ({ requestedUrl: url, finalUrl: url, html: '<p>Source</p>' }));
  const incomingExecute = t.mock.fn(async (): Promise<StepResult<string>> => ({ decision: 'allow', output: 'Exact Markdown' }));
  const records = { record };
  const fetch = createFetchPage({ fetcher: { fetchURL }, outgoing, incoming: { execute: incomingExecute }, records });
  return {
    outgoing, execute, records, fetchURL, incomingExecute, allEntries,
    fetch: (execution: ExecutionContext) => fetch(url, context, execution),
    get entries() { return allEntries.filter((entry) => entry.stepId === 'outgoing.observe_request'); },
    get recordAttempts() { return record.mock.calls.filter((call) => call.arguments[0].stepId === 'outgoing.observe_request'); },
  };
}

test('Given an allowed exact URL and a trusted execution, when the public fetch operation runs, then it passes only input and the same signal and writes one fixed allowed record', async (t) => {
  const dependencies = fixture(t);
  const execution = executionContextOf();
  t.mock.method(performance, 'now', () => 17);

  assert.deepEqual(await dependencies.fetch(execution), { status: 'released', markdown: 'Exact Markdown' });

  assert.equal(dependencies.execute.mock.callCount(), 1);
  assert.equal(dependencies.execute.mock.calls[0].arguments[0], url);
  assert.equal(dependencies.execute.mock.calls[0].arguments[1], execution.signal);
  assert.equal(dependencies.execute.mock.calls[0].arguments.length, 2);
  assert.deepEqual(dependencies.fetchURL.mock.calls[0].arguments, [url, execution.signal]);
  assert.equal(dependencies.incomingExecute.mock.callCount(), 1);
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

    await assert.rejects(dependencies.fetch(execution), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, 'Page fetch failed');
      assert.equal(error.cause, undefined);
      return true;
    });

    assert.equal(dependencies.execute.mock.callCount(), 1);
    assertNoPageWork(dependencies);
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

  await assert.rejects(dependencies.fetch(execution), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.message, 'Page fetch failed');
    assert.equal(error.cause, undefined);
    return true;
  });

  assertNoPageWork(dependencies);
  assert.deepEqual(dependencies.entries, [{ event: 'pipeline.step.completed', operationId: execution.operationId,
    stepId: 'outgoing.observe_request', outcome: 'failed', code: 'step_failed', durationMs: 0 }]);
});

for (const result of [{ decision: 'allow', output: url }, { decision: 'block', code: 'scan_failed' }]) {
  test(`Given an incoming ID supplied by an outgoing step with ${result.decision}, when it runs, then the trusted outgoing binding controls its record and code rules`, async (t) => {
    const dependencies = fixture(t, result);
    Object.defineProperty(dependencies.outgoing, 'id', { get: () => { throw new Error('The executor must not read the supplied ID'); } });
    if (result.decision === 'allow') assert.deepEqual(await dependencies.fetch(executionContextOf()), { status: 'released', markdown: 'Exact Markdown' });
    else await assert.rejects(dependencies.fetch(executionContextOf()), { message: 'Page fetch failed' });
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

  assert.deepEqual(await dependencies.fetch(executionContextOf()), { status: 'released', markdown: 'Exact Markdown' });

  assert.deepEqual(reads, { decision: 1, output: 1 });
  assert.equal(dependencies.entries[0].outcome, 'allowed');
});

test('Given a block code getter that changes on a second read, when validated, then the captured permitted code is recorded once', async (t) => {
  let reads = 0;
  const dependencies = fixture(t, { decision: 'block', get code() { return ++reads === 1 ? 'blocked' : 'scan_failed'; } });

  await assert.rejects(dependencies.fetch(executionContextOf()), { message: 'Page fetch failed' });

  assert.equal(reads, 1);
  assert.equal(dependencies.entries[0].outcome, 'blocked');
  assert.equal('code' in dependencies.entries[0] && dependencies.entries[0].code, 'blocked');
});

for (const outcome of ['allow', 'block', 'throw'] as const) {
  test(`Given ${outcome} and a sink that throws, when the public operation settles, then its result holds with one execution and one write attempt`, async (t) => {
    const dependencies = fixture(t, outcome === 'block' ? { decision: 'block', code: 'blocked' } : { decision: 'allow', output: url });
    if (outcome === 'throw') dependencies.execute.mock.mockImplementation(async () => { throw new Error('private-step-error'); });
    dependencies.records.record.mock.mockImplementation((entry) => {
      if (entry.stepId === 'outgoing.observe_request') throw new Error('private-sink-error');
      dependencies.allEntries.push(entry);
    });

    if (outcome === 'allow') assert.deepEqual(await dependencies.fetch(executionContextOf()), { status: 'released', markdown: 'Exact Markdown' });
    else await assert.rejects(dependencies.fetch(executionContextOf()), { message: 'Page fetch failed' });

    assert.equal(dependencies.execute.mock.callCount(), 1);
    assert.equal(dependencies.recordAttempts.length, 1);
    if (outcome === 'allow') {
      assert.equal(dependencies.fetchURL.mock.callCount(), 1);
      assert.equal(dependencies.incomingExecute.mock.callCount(), 1);
    } else assertNoPageWork(dependencies);
  });
}

test('Given cancellation before entry, when the public operation is called, then neither the step nor its record starts', async (t) => {
  const dependencies = fixture(t);
  const controller = new AbortController();
  controller.abort(new Error('private-abort-reason'));

  await assert.rejects(dependencies.fetch(executionContextOf(controller.signal)), { name: 'AbortError', message: 'Request cancelled' });

  assert.equal(dependencies.execute.mock.callCount(), 0);
  assert.deepEqual(dependencies.allEntries, []);
  assertNoPageWork(dependencies);
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
    const pending = dependencies.fetch(execution).then(
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
    assertNoPageWork(dependencies);
  });
}

test('Given a collaborator AbortError before the signal changes, when handled even with a broken sink, then safe cancellation wins and is recorded once', async (t) => {
  const dependencies = fixture(t);
  const execution = executionContextOf();
  dependencies.execute.mock.mockImplementation(async () => { throw new DOMException('private-cause', 'AbortError'); });
  dependencies.records.record.mock.mockImplementation((entry) => {
    if (entry.stepId === 'outgoing.observe_request') throw new Error('private-sink-error');
    dependencies.allEntries.push(entry);
  });

  await assert.rejects(dependencies.fetch(execution), { name: 'AbortError', message: 'Request cancelled' });

  assert.equal(execution.signal.aborted, false);
  assert.equal(dependencies.recordAttempts.length, 1);
  assert.equal(dependencies.recordAttempts[0].arguments[0].outcome, 'cancelled');
});

test('Given an allowed output accessor that aborts the request, when validation reads it, then cancellation is recorded before any allowed result', async (t) => {
  const controller = new AbortController();
  const dependencies = fixture(t, { decision: 'allow', get output() { controller.abort(); return url; } });

  await assert.rejects(dependencies.fetch(executionContextOf(controller.signal)), { name: 'AbortError', message: 'Request cancelled' });

  assert.equal(dependencies.entries.length, 1);
  assert.equal(dependencies.entries[0].outcome, 'cancelled');
});

function assertNoPageWork(dependencies: ReturnType<typeof fixture>): void {
  assert.equal(dependencies.fetchURL.mock.callCount(), 0);
  assert.equal(dependencies.incomingExecute.mock.callCount(), 0);
}
