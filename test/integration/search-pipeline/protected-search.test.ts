import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SearchPipeline } from '../../../src/pipelines/search/search-pipeline.ts';
import { createRequestContext } from '../../../src/accounts/identity/access-context.ts';
import type { StepRecord } from '../../../src/pipelines/execution/step-record.ts';
import type { StepResult } from '../../../src/pipelines/execution/pipeline-step.ts';
import type { SearchDocument } from '../../../src/pipelines/providers/search-engine/search-engine.ts';
import { WebsiteFetchHttpError, WebsiteFetchLaunchError, WebsiteFetchReadinessTimeoutError } from '../../../src/pipelines/providers/website-fetcher/website-fetcher.ts';

const context = createRequestContext({ user: { authority: 'test', subject: 'reader' }, tenantId: 'tenant', grants: [{ role: 'reader', permissions: ['product:access'] }] });
const page = { requestedUrl: 'https://search.example/', finalUrl: 'https://search.example/', html: '<p>private page</p>' };
function fixture() {
  const controller = new AbortController();
  const execution = { signal: controller.signal, operationId: '8cfc6637-98b1-4b3a-a522-8d3e5ae979cf' };
  const calls: string[] = [];
  const entries: StepRecord[] = [];
  const dependencies = {
    outgoing: { execute: async (query: string, _signal: AbortSignal): Promise<StepResult<string, 'blocked'>> => { calls.push('outgoing'); return { decision: 'allow', output: query }; } },
    engine: { search: async (query: string, signal: AbortSignal): Promise<SearchDocument> => { calls.push('engine'); assert.equal(query, ' private query 😃 '); assert.equal(signal, execution.signal); return { page, kind: 'results' }; } },
    incoming: { execute: async (input: typeof page, _signal: AbortSignal): Promise<StepResult<string>> => { calls.push('incoming'); assert.equal(input, page); return { decision: 'allow', output: '\n# Safe result\n' }; } },
    records: { record: (entry: StepRecord) => { entries.push(entry); } },
  };
  return { controller, execution, calls, entries, dependencies, run: () => new SearchPipeline(dependencies).search(' private query 😃 ', context, execution) };
}

test('Given authorized search, when the protected pipeline runs, then it preserves the query and page and releases processed Markdown with safe records', async () => {
  const f = fixture();
  assert.deepEqual(await f.run(), { status: 'released', markdown: '\n# Safe result\n' });
  assert.deepEqual(f.calls, ['outgoing', 'engine', 'incoming']);
  assert.deepEqual(f.entries.map(({ stepId, outcome }) => ({ stepId, outcome })), [{ stepId: 'search.outgoing.observe_request', outcome: 'allowed' }, { stepId: 'search.incoming.process_html', outcome: 'allowed' }]);
  for (const entry of f.entries) { assert.equal(entry.operationId, f.execution.operationId); assert.ok(Number.isSafeInteger(entry.durationMs) && entry.durationMs >= 0); }
  assert.doesNotMatch(JSON.stringify(f.entries), /private|Safe result/);
});

for (const kind of ['results', 'no_results'] as const) {
  for (const code of ['scan_failed', 'scan_limit'] as const) {
    test(`Given ${kind} and incoming ${code}, when processed, then withholding wins`, async () => {
      const f = fixture(); f.dependencies.engine.search = async () => { f.calls.push('engine'); return { page, kind }; };
      f.dependencies.incoming.execute = async () => ({ decision: 'block', code });
      assert.deepEqual(await f.run(), { status: 'withheld', code });
      assert.equal(f.calls.filter((call) => call === 'engine').length, 1);
      assert.equal(f.entries[1].outcome, 'blocked');
    });
  }
  test(`Given ${kind} with blank Markdown, when processed, then the final decision follows the page kind`, async () => {
    const f = fixture(); f.dependencies.engine.search = async () => ({ page, kind });
    f.dependencies.incoming.execute = async () => ({ decision: 'allow', output: ' \n' });
    if (kind === 'results') {
      await assert.rejects(f.run(), { message: 'Search processing failed' });
      assert.equal(f.entries[1].outcome, 'allowed');
    } else assert.deepEqual(await f.run(), { status: 'released', markdown: 'No search results.' });
  });
}

for (const value of [null, [], {}, { kind: 'challenge', page }, { kind: 'results', page: null }, { kind: 'results', page: { ...page, html: 5 } }]) {
  test('Given a malformed engine document, when searched, then processing never starts', async () => {
    const f = fixture(); f.dependencies.engine.search = async () => value as SearchDocument;
    await assert.rejects(f.run(), { message: 'Search failed' });
    assert.deepEqual(f.calls, ['outgoing']); assert.equal(f.entries.length, 1);
  });
}

for (const stage of ['outgoing', 'incoming'] as const) {
  for (const value of [null, [], {}, Object.create({ decision: 'allow', output: 'private query' }), { decision: 'allow', output: 'changed' }, { decision: 'block', code: 'blocked', output: 'private' }, { decision: 'allow', output: 4, code: 'blocked' }, { decision: 'allow', output: 4 }, { decision: 'allow', output: 'changed', code: 'blocked' }, { decision: 'block', code: 'blocked' }]) {
    if (stage === 'incoming' && value !== null && Object.hasOwn(value, 'output') && value.output === 'changed' && !Object.hasOwn(value, 'code')) continue;
    test(`Given invalid or refused ${stage}, when searched, then the fixed failure hides content`, async () => {
      const f = fixture(); f.dependencies[stage].execute = async () => value as never;
      await assert.rejects(f.run(), { message: stage === 'outgoing' ? 'Search failed' : 'Search processing failed' });
      assert.equal(f.calls.filter((call) => call === 'engine').length, stage === 'incoming' ? 1 : 0);
      const terminal = value !== null && Object.hasOwn(value, 'decision') && value.decision === 'block' && !Object.hasOwn(value, 'output') ? { outcome: 'blocked', code: 'blocked' } : { outcome: 'failed', code: 'invalid_step_result' };
      assert.deepEqual(f.entries.map((entry) => ({ outcome: entry.outcome, ...('code' in entry ? { code: entry.code } : {}) })), stage === 'outgoing' ? [terminal] : [{ outcome: 'allowed' }, terminal]);
      assert.doesNotMatch(JSON.stringify(f.entries), /private|changed/);
    });
  }
}

for (const boundary of ['outgoing', 'engine', 'incoming', 'outgoing-record', 'incoming-record'] as const) {
  for (const lateFailure of [false, true]) {
    test(`Given cancellation at ${boundary} with late failure ${lateFailure}, when settled, then cancellation wins`, async () => {
      const f = fixture();
      const cancel = () => { f.controller.abort('private reason'); if (lateFailure) throw new Error('private failure'); };
      if (boundary === 'engine') f.dependencies.engine.search = async () => { cancel(); return { page, kind: 'results' }; };
      else if (boundary === 'outgoing') f.dependencies.outgoing.execute = async (input) => { cancel(); return { decision: 'allow', output: input }; };
      else if (boundary === 'incoming') f.dependencies.incoming.execute = async () => { cancel(); return { decision: 'allow', output: 'private late result' }; };
      else f.dependencies.records.record = (entry) => { f.entries.push(entry); if (entry.stepId === (boundary === 'outgoing-record' ? 'search.outgoing.observe_request' : 'search.incoming.process_html')) cancel(); };
      await assert.rejects(f.run(), { name: 'AbortError', message: 'Request cancelled' });
      if (boundary.startsWith('outgoing')) assert.ok(!f.calls.includes('engine'));
      const cancelled = { outcome: 'cancelled', code: 'cancelled' }; const allowed = { outcome: 'allowed' };
      const expected = boundary === 'outgoing' ? [cancelled] : boundary === 'incoming' ? [allowed, cancelled] : boundary === 'incoming-record' ? [allowed, allowed] : [allowed];
      assert.deepEqual(f.entries.map((entry) => ({ outcome: entry.outcome, ...('code' in entry ? { code: entry.code } : {}) })), expected);
    });
  }
}

for (const guard of ['cancellation', 'permission', 'query', 'operation'] as const) {
  test(`Given failing ${guard} and later guards, when called, then validation has no effects`, async () => {
    const f = fixture(); if (guard === 'cancellation') f.controller.abort();
    const trusted = guard === 'permission' || guard === 'cancellation' ? { ...context, permissions: [] } : context;
    const reports: unknown[] = [];
    await assert.rejects(new SearchPipeline({ ...f.dependencies, reportFetchFailure: (report) => { reports.push(report); } }).search(guard === 'operation' ? 'valid' : '', trusted, { ...f.execution, operationId: 'private invalid' }), {
      message: { cancellation: 'Request cancelled', permission: 'Access denied', query: 'Invalid tool arguments', operation: 'Invalid execution context' }[guard],
    });
    assert.deepEqual(f.calls, []); assert.deepEqual(f.entries, []); assert.deepEqual(reports, []);
  });
}

for (const canonical of [false, true]) {
  test(`Given canonical renderer failure ${canonical}, when searched, then only renderer diagnostics are reported and raw data stays private`, async () => {
    const f = fixture(); const reports: unknown[] = [];
    f.dependencies.engine.search = async () => { throw canonical ? new WebsiteFetchHttpError(429, { cause: new Error('private cause') }) : new Error('private provider'); };
    const pipeline = new SearchPipeline({ ...f.dependencies, reportFetchFailure: (report) => { reports.push(report); throw new Error('private report'); } });
    await assert.rejects(pipeline.search(' private query 😃 ', context, f.execution), (error: Error) => { assert.equal(error.message, canonical ? 'Search failed: HTTP 429' : 'Search failed'); assert.equal(error.cause, undefined); assert.doesNotMatch(JSON.stringify(error), /private/); return true; });
    assert.deepEqual(reports, canonical ? [{ category: 'http', phase: 'renderer_result', httpStatus: 429, operationId: f.execution.operationId }] : []);
  });
}

test('Given a renderer reporter that aborts, when failure is reported, then cancellation wins', async () => {
  const f = fixture(); f.dependencies.engine.search = async () => { throw new WebsiteFetchHttpError(503); };
  await assert.rejects(new SearchPipeline({ ...f.dependencies, reportFetchFailure: () => { f.controller.abort(); } }).search(' private query 😃 ', context, f.execution), { name: 'AbortError', message: 'Request cancelled' });
});

test('Given failing record writes, when search succeeds, then both stages run once', async () => {
  const f = fixture(); let attempts = 0; f.dependencies.records.record = () => { attempts += 1; throw new Error('private sink'); };
  assert.equal((await f.run()).status, 'released'); assert.deepEqual(f.calls, ['outgoing', 'engine', 'incoming']); assert.equal(attempts, 2);
});

for (const stage of ['outgoing', 'engine', 'incoming'] as const) {
  test(`Given ${stage} throws an AbortError without signal cancellation, when settled, then the safe cancellation remains`, async () => {
    const f = fixture(); const abort = async (): Promise<never> => { f.calls.push(stage); throw new DOMException('private abort', 'AbortError'); };
    if (stage === 'engine') f.dependencies.engine.search = abort;
    else f.dependencies[stage].execute = abort;
    await assert.rejects(f.run(), { name: 'AbortError', message: 'Request cancelled' });
    assert.equal(f.execution.signal.aborted, false);
    assert.deepEqual(f.calls, stage === 'outgoing' ? ['outgoing'] : stage === 'engine' ? ['outgoing', 'engine'] : ['outgoing', 'engine', 'incoming']);
    assert.deepEqual(f.entries.map(({ outcome, ...entry }) => [outcome, 'code' in entry ? entry.code : undefined]), stage === 'outgoing' ? [['cancelled', 'cancelled']] : stage === 'engine' ? [['allowed', undefined]] : [['allowed', undefined], ['cancelled', 'cancelled']]);
    assert.doesNotMatch(JSON.stringify(f.entries), /private/);
  });
}

test('Given concurrent searches on one pipeline, when engines finish in reverse order, then queries, signals, results and records stay isolated', async () => {
  const f = fixture();
  const pending = new Map<string, (document: SearchDocument) => void>();
  const signals = new Map<string, AbortSignal>();
  const started = Promise.withResolvers<void>();
  const pipeline = new SearchPipeline({
    ...f.dependencies,
    engine: { search: (query, signal) => { signals.set(query, signal); return new Promise((resolve) => { pending.set(query, resolve); if (pending.size === 2) started.resolve(); }); } },
    incoming: { execute: async (input) => ({ decision: 'allow', output: input.html }) },
  });
  const other = { signal: new AbortController().signal, operationId: '7cfc6637-98b1-4b3a-a522-8d3e5ae979cf' };
  const first = pipeline.search('first', context, f.execution);
  const second = pipeline.search('second', { ...context, tenantId: 'other' }, other);
  await started.promise;
  const finishSecond = pending.get('second'); const finishFirst = pending.get('first');
  assert.ok(finishSecond); assert.ok(finishFirst);
  finishSecond({ kind: 'results', page: { ...page, html: 'second result' } });
  assert.deepEqual(await second, { status: 'released', markdown: 'second result' });
  finishFirst({ kind: 'results', page: { ...page, html: 'first result' } });
  assert.deepEqual(await first, { status: 'released', markdown: 'first result' });
  assert.equal(signals.get('first'), f.execution.signal); assert.equal(signals.get('second'), other.signal);
  assert.equal(f.entries.filter((entry) => entry.operationId === f.execution.operationId).length, 2);
  assert.equal(f.entries.filter((entry) => entry.operationId === other.operationId).length, 2);
});

test('Given a mutable engine document, when incoming changes its classification, then the validated classification stays fixed', async () => {
  const f = fixture(); const document: SearchDocument = { page, kind: 'results' };
  f.dependencies.engine.search = async () => document;
  f.dependencies.incoming.execute = async () => { document.kind = 'no_results'; return { decision: 'allow', output: 'original result' }; };
  assert.deepEqual(await f.run(), { status: 'released', markdown: 'original result' });
});

for (const query of ['x'.repeat(512), '😃'.repeat(512), '\nUnicode café 日本語\t']) {
  test('Given a valid boundary query, when searched, then the engine receives its exact text', async () => {
    const f = fixture(); f.dependencies.engine.search = async (input, signal) => { assert.equal(input, query); assert.equal(signal, f.execution.signal); return { page, kind: 'results' }; };
    assert.equal((await new SearchPipeline(f.dependencies).search(query, context, f.execution)).status, 'released');
  });
}

for (const query of ['x'.repeat(513), '😃'.repeat(513), '\uD800', '\uDC00', '\t\n']) {
  test('Given invalid search text, when searched, then validation starts no work', async () => {
    const f = fixture();
    await assert.rejects(new SearchPipeline(f.dependencies).search(query, context, f.execution), { message: 'Invalid tool arguments' });
    assert.deepEqual(f.calls, []); assert.deepEqual(f.entries, []);
  });
}

test('Given a canonical renderer error with a throwing diagnostic getter, when searched, then no raw error escapes', async () => {
  const f = fixture(); const error = new WebsiteFetchHttpError(429);
  Object.defineProperty(error, 'diagnostic', { get() { throw new Error('private diagnostic getter'); } });
  f.dependencies.engine.search = async () => { throw error; };
  await assert.rejects(f.run(), { message: 'Search failed' });
});

for (const cancel of [false, true]) {
  test(`Given a throwing result getter with cancellation ${cancel}, when validated, then it never becomes a renderer report`, async () => {
    const f = fixture(); const reports: unknown[] = [];
    f.dependencies.engine.search = async () => ({ page, get kind(): 'results' { if (cancel) f.controller.abort(); throw new WebsiteFetchHttpError(429); } });
    await assert.rejects(new SearchPipeline({ ...f.dependencies, reportFetchFailure: (report) => { reports.push(report); } }).search(' private query 😃 ', context, f.execution), { message: cancel ? 'Request cancelled' : 'Search failed' });
    assert.deepEqual(reports, []); assert.ok(!f.calls.includes('incoming'));
  });
}

for (const field of ['requestedUrl', 'finalUrl', 'html'] as const) {
  for (const malformed of ['missing', 'number', 'inherited'] as const) {
    test(`Given engine page ${field} is ${malformed}, when checked, then no incoming or renderer report starts`, async () => {
      const f = fixture(); const invalid = { ...page } as Record<string, unknown>;
      if (malformed === 'number') invalid[field] = 4;
      else { delete invalid[field]; if (malformed === 'inherited') Object.setPrototypeOf(invalid, { [field]: page[field] }); }
      f.dependencies.engine.search = async () => ({ page: invalid, kind: 'results' }) as unknown as SearchDocument;
      const reports: unknown[] = [];
      await assert.rejects(new SearchPipeline({ ...f.dependencies, reportFetchFailure: (report) => { reports.push(report); } }).search(' private query 😃 ', context, f.execution), { message: 'Search failed' });
      assert.deepEqual(reports, []); assert.ok(!f.calls.includes('incoming'));
    });
  }
}

for (const stage of ['outgoing', 'incoming'] as const) {
  test(`Given a plain thrown ${stage} error, when settled, then one failed record represents that entered stage`, async () => {
    const f = fixture(); f.dependencies[stage].execute = async () => { throw new Error('private stage'); };
    await assert.rejects(f.run(), { message: stage === 'outgoing' ? 'Search failed' : 'Search processing failed' });
    assert.deepEqual(f.calls, stage === 'outgoing' ? [] : ['outgoing', 'engine']);
    assert.deepEqual(f.entries.map(({ outcome, ...entry }) => [outcome, 'code' in entry ? entry.code : undefined]), stage === 'outgoing' ? [['failed', 'step_failed']] : [['allowed', undefined], ['failed', 'step_failed']]);
  });
}

test('Given every stage, when search succeeds, then exact original inputs and signals cross each boundary', async () => {
  const f = fixture(); const argumentsByStage: unknown[][] = [];
  f.dependencies.outgoing.execute = async (...args) => { argumentsByStage.push(args); return { decision: 'allow', output: args[0] }; };
  f.dependencies.engine.search = async (...args) => { argumentsByStage.push(args); return { page, kind: 'results' }; };
  f.dependencies.incoming.execute = async (...args) => { argumentsByStage.push(args); return { decision: 'allow', output: 'result' }; };
  await f.run();
  assert.deepEqual(argumentsByStage, [[' private query 😃 ', f.execution.signal], [' private query 😃 ', f.execution.signal], [page, f.execution.signal]]);
});

for (const output of ['provider says nothing', '']) {
  test(`Given no-results with allowed incoming text ${JSON.stringify(output)}, when settled, then only fixed absence text is released`, async () => {
    const f = fixture(); f.dependencies.engine.search = async () => ({ page, kind: 'no_results' }); f.dependencies.incoming.execute = async () => ({ decision: 'allow', output });
    assert.deepEqual(await f.run(), { status: 'released', markdown: 'No search results.' });
  });
}
for (const failure of ['throw', 'malformed', 'blocked'] as const) {
  test(`Given no-results and incoming ${failure}, when settled, then absence cannot override failure`, async () => {
    const f = fixture(); f.dependencies.engine.search = async () => { f.calls.push('engine'); return { page, kind: 'no_results' }; };
    f.dependencies.incoming.execute = async () => { if (failure === 'throw') throw new Error('private incoming'); return failure === 'blocked' ? { decision: 'block', code: 'blocked' } : {} as never; };
    await assert.rejects(f.run(), { message: 'Search processing failed' });
    assert.equal(f.calls.filter((call) => call === 'engine').length, 1);
  });
}

for (const failure of [new WebsiteFetchLaunchError('ENOENT', 'private launch'), new WebsiteFetchReadinessTimeoutError()]) {
  test(`Given canonical ${failure.name}, when reporters mutate diagnostics and throw, then captured public detail stays safe`, async () => {
    const f = fixture(); f.dependencies.engine.search = async () => { throw failure; }; const reports: unknown[] = [];
    const pipeline = new SearchPipeline({ ...f.dependencies, reportFetchFailure: () => { Object.assign(failure.diagnostic, { category: 'unknown', phase: 'unknown' }); throw new Error('private report'); }, reportRendererSetupFailure: (report) => { reports.push(report); }, reportRendererReadinessTimeout: (report) => { reports.push(report); } });
    await assert.rejects(pipeline.search(' private query 😃 ', context, f.execution), { message: failure instanceof WebsiteFetchLaunchError ? 'Search failed: Renderer could not start' : 'Search failed: Renderer readiness timed out' });
    assert.deepEqual(reports, failure instanceof WebsiteFetchLaunchError ? [{ failure: 'missing', code: 'ENOENT' }] : [{ category: 'readiness_timeout', budgetMs: 20_000 }]);
  });
}

for (const [label, value] of [
  ['missing kind', { page }], ['numeric kind', { page, kind: 5 }], ['missing page', { kind: 'results' }], ['string page', { kind: 'results', page: 'private' }],
  ['inherited kind', Object.assign(Object.create({ kind: 'results' }), { page })], ['inherited page', Object.assign(Object.create({ page }), { kind: 'results' })],
] as const) {
  test(`Given engine document has ${label}, when checked, then only the entered outgoing record exists`, async () => {
    const f = fixture(); f.dependencies.engine.search = async () => value as SearchDocument;
    await assert.rejects(f.run(), { message: 'Search failed' });
    assert.deepEqual(f.entries.map(({ stepId, outcome }) => ({ stepId, outcome })), [{ stepId: 'search.outgoing.observe_request', outcome: 'allowed' }]);
  });
}

for (const stage of ['outgoing', 'engine', 'incoming'] as const) {
  test(`Given an error at ${stage} whose name getter throws, when protected search settles, then its fixed failure and entered-stage records stay safe`, async () => {
    const f = fixture();
    const failure = new Error('private collaborator failure', { cause: new Error('private cause') });
    let reads = 0;
    Object.defineProperty(failure, 'name', { get() { reads++; throw new Error('private name getter'); } });
    const fail = async (): Promise<never> => { f.calls.push(stage); throw failure; };
    if (stage === 'engine') f.dependencies.engine.search = fail;
    else f.dependencies[stage].execute = fail;

    await assert.rejects(f.run(), (error: Error) => {
      assert.equal(error.message, stage === 'incoming' ? 'Search processing failed' : 'Search failed');
      assert.equal(error.cause, undefined);
      assert.doesNotMatch(JSON.stringify(error), /private/);
      return true;
    });
    assert.equal(reads, 1);
    assert.deepEqual(f.calls, stage === 'outgoing' ? ['outgoing'] : stage === 'engine' ? ['outgoing', 'engine'] : ['outgoing', 'engine', 'incoming']);
    const allowed = { event: 'pipeline.step.completed', stepId: 'search.outgoing.observe_request', outcome: 'allowed' };
    const failed = { event: 'pipeline.step.completed', stepId: `search.${stage}.` + (stage === 'outgoing' ? 'observe_request' : 'process_html'), outcome: 'failed', code: 'step_failed' };
    assert.deepEqual(f.entries.map(({ operationId, durationMs, ...entry }) => {
      assert.equal(operationId, f.execution.operationId);
      assert.ok(Number.isSafeInteger(durationMs) && durationMs >= 0);
      return entry;
    }), stage === 'outgoing' ? [failed] : stage === 'engine' ? [allowed] : [allowed, failed]);
    assert.doesNotMatch(JSON.stringify(f.entries), /private/);
  });
}

for (const stage of ['outgoing', 'engine', 'incoming'] as const) {
  test(`Given ${stage} aborts before throwing a hostile error, when settled, then cancellation wins without reading its name`, async () => {
    const f = fixture();
    let reads = 0;
    const failure = Object.defineProperty(new Error('private failure'), 'name', { get() { reads++; throw new Error('private name'); } });
    const fail = async (): Promise<never> => { f.calls.push(stage); f.controller.abort('private reason'); throw failure; };
    if (stage === 'engine') f.dependencies.engine.search = fail;
    else f.dependencies[stage].execute = fail;
    await assert.rejects(f.run(), { name: 'AbortError', message: 'Request cancelled' });
    assert.equal(reads, 0);
    assert.deepEqual(f.calls, stage === 'outgoing' ? ['outgoing'] : stage === 'engine' ? ['outgoing', 'engine'] : ['outgoing', 'engine', 'incoming']);
    assert.deepEqual(f.entries.map(({ outcome, ...entry }) => [outcome, 'code' in entry ? entry.code : undefined]), stage === 'outgoing' ? [['cancelled', 'cancelled']] : stage === 'engine' ? [['allowed', undefined]] : [['allowed', undefined], ['cancelled', 'cancelled']]);
    assert.doesNotMatch(JSON.stringify(f.entries), /private/);
  });

  test(`Given the ${stage} error name getter aborts and returns a different name, when inspected, then cancellation wins with cancelled stage records`, async () => {
    const f = fixture();
    let reads = 0;
    const failure = Object.defineProperty(new Error('private failure'), 'name', { get() { reads++; f.controller.abort('private reason'); return 'OtherError'; } });
    const fail = async (): Promise<never> => { f.calls.push(stage); throw failure; };
    if (stage === 'engine') f.dependencies.engine.search = fail;
    else f.dependencies[stage].execute = fail;
    await assert.rejects(f.run(), { name: 'AbortError', message: 'Request cancelled' });
    assert.equal(reads, 1);
    assert.deepEqual(f.calls, stage === 'outgoing' ? ['outgoing'] : stage === 'engine' ? ['outgoing', 'engine'] : ['outgoing', 'engine', 'incoming']);
    assert.deepEqual(f.entries.map(({ outcome, ...entry }) => [outcome, 'code' in entry ? entry.code : undefined]), stage === 'outgoing' ? [['cancelled', 'cancelled']] : stage === 'engine' ? [['allowed', undefined]] : [['allowed', undefined], ['cancelled', 'cancelled']]);
  });

  for (const cancel of [false, true]) {
    test(`Given ${stage} throws a proxy whose prototype inspection throws with cancellation ${cancel}, when settled, then the safe boundary holds`, async () => {
      const f = fixture();
      const failure = new Proxy(new Error('private failure'), { getPrototypeOf() { if (cancel) f.controller.abort('private reason'); throw new Error('private prototype'); } });
      const fail = async (): Promise<never> => { f.calls.push(stage); throw failure; };
      if (stage === 'engine') f.dependencies.engine.search = fail;
      else f.dependencies[stage].execute = fail;
      await assert.rejects(f.run(), (error: Error) => {
        assert.equal(error.message, cancel ? 'Request cancelled' : stage === 'incoming' ? 'Search processing failed' : 'Search failed');
        assert.equal(error.name, cancel ? 'AbortError' : stage === 'engine' ? 'SearchFailure' : 'Error');
        assert.equal(error.cause, undefined);
        assert.doesNotMatch(JSON.stringify(error), /private/);
        return true;
      });
      assert.deepEqual(f.calls, stage === 'outgoing' ? ['outgoing'] : stage === 'engine' ? ['outgoing', 'engine'] : ['outgoing', 'engine', 'incoming']);
      const terminal = cancel ? ['cancelled', 'cancelled'] : ['failed', 'step_failed'];
      assert.deepEqual(f.entries.map(({ outcome, ...entry }) => [outcome, 'code' in entry ? entry.code : undefined]), stage === 'outgoing' ? [terminal] : stage === 'engine' ? [['allowed', undefined]] : [['allowed', undefined], terminal]);
      assert.doesNotMatch(JSON.stringify(f.entries), /private/);
    });
  }
}
