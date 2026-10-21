import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import { createRequestContext } from '../../../src/accounts/identity/access-context.ts';
import { createFetchPage } from '../../../src/pipelines/page-fetch/fetch-page.ts';
import type { StepResult } from '../../../src/pipelines/execution/pipeline-step.ts';
import type { StepRecord } from '../../../src/pipelines/execution/step-record.ts';
import { WebsiteFetchHttpError, type WebsiteFetchResult } from '../../../src/pipelines/providers/website-fetcher/website-fetcher.ts';
import { executionContextOf } from '../../support/fixtures/execution-context.ts';

const url = 'https://source.example/article';
const page: WebsiteFetchResult = { requestedUrl: url, finalUrl: 'https://destination.example/final', html: '<p>Source</p>' };
const context = createRequestContext({
  user: { authority: 'https://synthetic.example/', subject: 'synthetic-user' },
  tenantId: 'synthetic-workspace',
  grants: [{ role: 'reader', permissions: ['product:access'] }],
});

describe('Protected neutral page fetch operation and access contract', () => {
  test('Given a private invalid operation ID, when the protected operation is called, then no work starts and only the fixed context error is returned', async (t) => {
    const dependencies = operationDoubles(t);
    const execution = { ...executionContextOf(), operationId: 'private-operation-id' };

    await assert.rejects(createFetchPage(dependencies)(url, context, execution), {
      message: 'Invalid execution context',
    });

    assert.equal(dependencies.fetcher.fetchURL.mock.callCount(), 0);
    assert.equal(dependencies.incoming.execute.mock.callCount(), 0);
    assert.equal(dependencies.outgoing.execute.mock.callCount(), 0);
    assert.deepEqual(dependencies.entries, []);
  });

  for (const guard of ['cancellation', 'permission', 'URL'] as const) {
    test(`Given an invalid operation ID and failing ${guard} guard, when called, then the existing guard takes precedence`, async (t) => {
      const dependencies = operationDoubles(t);
      const controller = new AbortController();
      if (guard === 'cancellation') controller.abort();
      const trusted = guard === 'URL' ? context : createRequestContext({ user: context.user, tenantId: context.tenantId, grants: [] });
      const execution = { signal: controller.signal, operationId: 'private-invalid-id' };
      const message = { cancellation: 'Request cancelled', permission: 'Access denied', URL: 'Invalid tool arguments' }[guard];

      await assert.rejects(createFetchPage(dependencies)('invalid URL', trusted, execution), { message });

      assert.equal(dependencies.fetcher.fetchURL.mock.callCount(), 0);
      assert.equal(dependencies.incoming.execute.mock.callCount(), 0);
      assert.equal(dependencies.outgoing.execute.mock.callCount(), 0);
      assert.deepEqual(dependencies.entries, []);
    });
  }

  test('Given a trusted context without product access, when the operation is called, then fetch never starts', async (t) => {
    const fetchURL = t.mock.fn(async () => page);
    const process = t.mock.fn(async (_source: WebsiteFetchResult): Promise<StepResult<string>> => ({ decision: 'allow', output: 'unused' }));
    const operation = createFetchPage({ ...operationDoubles(t), fetcher: { fetchURL }, incoming: { execute: process } });
    const denied = createRequestContext({ user: context.user, tenantId: context.tenantId, grants: [] });

    await assert.rejects(operation(url, denied, executionContextOf()), { name: 'AccessDeniedError', message: 'Access denied' });

    assert.equal(fetchURL.mock.callCount(), 0);
    assert.equal(process.mock.callCount(), 0);
  });

  test('Given a spelled URL and redirect metadata, when the operation completes, then collaborators receive them unchanged and return exact Markdown', async (t) => {
    const requestedUrl = 'HTTPS://Source.Example:443/a%2fb?q=%2f#Part';
    const fetched = { ...page, requestedUrl };
    const markdown = '\n# Exact title\n\nBody 😃\n';
    const fetchURL = t.mock.fn(async () => fetched);
    const process = t.mock.fn(async (_source: WebsiteFetchResult): Promise<StepResult<string>> => ({ decision: 'allow', output: markdown }));
    const signal = new AbortController().signal;
    const operation = createFetchPage({ ...operationDoubles(t), fetcher: { fetchURL }, incoming: { execute: process } });

    assert.deepEqual(await operation(requestedUrl, context, executionContextOf(signal)), { status: 'released', markdown });

    assert.deepEqual(fetchURL.mock.calls[0].arguments, [requestedUrl, signal]);
    assert.deepEqual(process.mock.calls[0].arguments, [fetched, signal]);
    assert.deepEqual(fetched, { ...page, requestedUrl });
  });

  for (const invalid of ['', ' ', '/relative', 'not a URL', 'https://', 'ftp://example.com/', 'https://user:password@example.com/', 'http://user@example.com/']) {
    test(`Given invalid URL ${JSON.stringify(invalid)}, when the operation is called, then no fetch runs`, async (t) => {
      const dependencies = operationDoubles(t);

      await assert.rejects(createFetchPage(dependencies)(invalid, context, executionContextOf()), {
        message: 'Invalid tool arguments',
      });

      assert.equal(dependencies.fetcher.fetchURL.mock.callCount(), 0);
      assert.equal(dependencies.incoming.execute.mock.callCount(), 0);
    });
  }

  for (const character of ['x', '😃']) {
    test(`Given an 8192 code-point URL with ${character}, when fetched, then the exact URL is accepted without truncation`, async (t) => {
      const prefix = 'https://example.com/';
      const boundedUrl = prefix + character.repeat(8192 - prefix.length);
      const dependencies = operationDoubles(t);
      const signal = new AbortController().signal;

      assert.deepEqual(await createFetchPage(dependencies)(boundedUrl, context, executionContextOf(signal)), { status: 'released', markdown: 'Exact Markdown' });
      assert.deepEqual(dependencies.fetcher.fetchURL.mock.calls[0].arguments, [boundedUrl, signal]);
    });

    test(`Given an 8193 code-point URL with ${character}, when called, then no fetch runs`, async (t) => {
      const prefix = 'https://example.com/';
      const dependencies = operationDoubles(t);

      await assert.rejects(createFetchPage(dependencies)(prefix + character.repeat(8193 - prefix.length), context, executionContextOf()), {
        message: 'Invalid tool arguments',
      });
      assert.equal(dependencies.fetcher.fetchURL.mock.callCount(), 0);
    });
  }

  test('Given a fetch failure, when it rejects, then only the safe fetch error is returned and processing never starts', async (t) => {
    const dependencies = operationDoubles(t);
    dependencies.fetcher.fetchURL.mock.mockImplementation(async () => { throw new Error('secret fetch cause'); });

    await assert.rejects(createFetchPage(dependencies)(url, context, executionContextOf()), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, 'Page fetch failed');
      assert.equal(error.cause, undefined);
      return true;
    });
    assert.equal(dependencies.fetcher.fetchURL.mock.callCount(), 1);
    assert.equal(dependencies.incoming.execute.mock.callCount(), 0);
  });

  test('Given a thrown processor failure, when it rejects, then only the safe processing error is returned', async (t) => {
    const dependencies = operationDoubles(t);
    dependencies.incoming.execute.mock.mockImplementation(async () => { throw new Error('secret partial Markdown'); });

    await assert.rejects(createFetchPage(dependencies)(url, context, executionContextOf()), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, 'Page processing failed');
      assert.equal(error.cause, undefined);
      return true;
    });
    assert.equal(dependencies.fetcher.fetchURL.mock.callCount(), 1);
  });

  test('Given empty processed Markdown, when the fetch completes, then the released outcome keeps exact empty text', async (t) => {
    const dependencies = operationDoubles(t);
    dependencies.incoming.execute.mock.mockImplementation(async () => ({ decision: 'allow', output: '' }));

    assert.deepEqual(await createFetchPage(dependencies)(url, context, executionContextOf()), { status: 'released', markdown: '' });
  });

  test('Given an allowed outgoing step, when fetch starts, then the step has received the exact URL and signal and its one allowed record has the operation ID', async (t) => {
    const dependencies = operationDoubles(t);
    const execution = executionContextOf();
    dependencies.fetcher.fetchURL.mock.mockImplementation(async (input, signal) => {
      assert.equal(input, url);
      assert.equal(signal, execution.signal);
      assert.equal(dependencies.entries.length, 1);
      assert.equal(dependencies.entries[0].operationId, execution.operationId);
      assert.equal(dependencies.entries[0].outcome, 'allowed');
      return page;
    });

    assert.deepEqual(await createFetchPage(dependencies)(url, context, execution), { status: 'released', markdown: 'Exact Markdown' });

    assert.equal(dependencies.outgoing.execute.mock.callCount(), 1);
    assert.equal(dependencies.outgoing.execute.mock.calls[0].arguments[0], url);
    assert.equal(dependencies.outgoing.execute.mock.calls[0].arguments[1], execution.signal);
  });

  for (const [name, result] of [
    ['block', { decision: 'block', code: 'blocked' }],
    ['wrong-direction code', { decision: 'block', code: 'scan_failed' }],
    ['unknown decision', { decision: 'step_up' }],
    ['changed output', { decision: 'allow', output: 'https://private-target.example/' }],
    ['nonstring output', { decision: 'allow', output: 42 }],
  ]) {
    test(`Given an outgoing ${name}, when the protected core executes, then fetch and processing never start and the safe fetch error holds`, async (t) => {
      const dependencies = operationDoubles(t);
      dependencies.outgoing.execute.mock.mockImplementation(async () => result as StepResult<string, 'blocked'>);

      await assert.rejects(createFetchPage(dependencies)(url, context, executionContextOf()), { message: 'Page fetch failed' });

      assert.equal(dependencies.fetcher.fetchURL.mock.callCount(), 0);
      assert.equal(dependencies.incoming.execute.mock.callCount(), 0);
      assert.equal(dependencies.entries.length, 1);
      assert.equal(dependencies.entries[0].outcome, name === 'block' ? 'blocked' : 'failed');
    });
  }

  test('Given a sink that throws, when the outgoing step allows, then fetch and processing run once and exact output remains', async (t) => {
    const dependencies = operationDoubles(t);
    dependencies.records.record.mock.mockImplementation(() => { throw new Error('private-sink-failure'); });

    assert.deepEqual(await createFetchPage(dependencies)(url, context, executionContextOf()), { status: 'released', markdown: 'Exact Markdown' });

    assert.equal(dependencies.records.record.mock.callCount(), 2);
    assert.equal(dependencies.outgoing.execute.mock.callCount(), 1);
    assert.equal(dependencies.fetcher.fetchURL.mock.callCount(), 1);
    assert.equal(dependencies.incoming.execute.mock.callCount(), 1);
  });

  test('Given a sink that aborts after the allowed record, when the core regains control, then the recorded outcome stays allowed and fetch never starts', async (t) => {
    const dependencies = operationDoubles(t);
    const controller = new AbortController();
    dependencies.records.record.mock.mockImplementation((entry) => { dependencies.entries.push(entry); controller.abort(); });

    await assert.rejects(createFetchPage(dependencies)(url, context, executionContextOf(controller.signal)), { name: 'AbortError', message: 'Request cancelled' });

    assert.equal(dependencies.entries.length, 1);
    assert.equal(dependencies.entries[0].outcome, 'allowed');
    assert.equal(dependencies.fetcher.fetchURL.mock.callCount(), 0);
    assert.equal(dependencies.incoming.execute.mock.callCount(), 0);
  });

  for (const stage of ['fetch', 'processor']) {
    test(`Given an allowed outgoing record and cancellation during ${stage}, when work settles, then the earlier step record remains allowed`, async (t) => {
      const dependencies = operationDoubles(t);
      const controller = new AbortController();
      if (stage === 'fetch') dependencies.fetcher.fetchURL.mock.mockImplementation(async () => { controller.abort(); return page; });
      else dependencies.incoming.execute.mock.mockImplementation(async () => { controller.abort(); return { decision: 'allow', output: 'late Markdown' }; });

      await assert.rejects(createFetchPage(dependencies)(url, context, executionContextOf(controller.signal)), { name: 'AbortError', message: 'Request cancelled' });

      assert.equal(dependencies.entries.length, stage === 'fetch' ? 1 : 2);
      assert.equal(dependencies.entries[0].outcome, 'allowed');
      if (stage === 'processor') assert.equal(dependencies.entries[1].outcome, 'cancelled');
    });
  }

  test('Given cancellation before fetch, when called, then no collaborator runs and the cancellation cause is withheld', async (t) => {
    const dependencies = operationDoubles(t);
    const controller = new AbortController();
    controller.abort(new Error('secret cancellation reason'));

    await assert.rejects(createFetchPage(dependencies)(url, context, executionContextOf(controller.signal)), { name: 'AbortError', message: 'Request cancelled' });
    assert.equal(dependencies.fetcher.fetchURL.mock.callCount(), 0);
    assert.equal(dependencies.incoming.execute.mock.callCount(), 0);
  });

  for (const stage of ['fetch', 'processor']) {
    test(`Given an AbortError from ${stage}, when the signal has not yet changed, then cancellation is still classified safely`, async (t) => {
      const dependencies = operationDoubles(t);
      const abort = async (): Promise<never> => { throw new DOMException('secret abort details', 'AbortError'); };
      if (stage === 'fetch') dependencies.fetcher.fetchURL.mock.mockImplementation(abort);
      else dependencies.incoming.execute.mock.mockImplementation(abort);

      await assert.rejects(createFetchPage(dependencies)(url, context, executionContextOf()), { name: 'AbortError', message: 'Request cancelled' });

      assert.equal(dependencies.incoming.execute.mock.callCount(), stage === 'fetch' ? 0 : 1);
    });

    for (const outcome of ['resolve', 'reject']) {
      test(`Given cancellation during ${stage}, when it then ${outcome}s, then cancellation takes priority and success stops`, async (t) => {
        const dependencies = operationDoubles(t);
        const controller = new AbortController();
        const cancel = () => {
          controller.abort(new Error('secret cancellation reason'));
          if (outcome === 'reject') throw new Error('secret collaborator failure');
        };
        if (stage === 'fetch') {
          dependencies.fetcher.fetchURL.mock.mockImplementation(async () => { cancel(); return page; });
        } else {
          dependencies.incoming.execute.mock.mockImplementation(async () => { cancel(); return { decision: 'allow', output: 'partial' }; });
        }

        await assert.rejects(createFetchPage(dependencies)(url, context, executionContextOf(controller.signal)), { name: 'AbortError', message: 'Request cancelled' });

        assert.equal(dependencies.fetcher.fetchURL.mock.callCount(), 1);
        assert.equal(dependencies.incoming.execute.mock.callCount(), stage === 'fetch' ? 0 : 1);
      });
    }
  }
});

function operationDoubles(t: TestContext) {
  const entries: StepRecord[] = [];
  return {
    entries,
    outgoing: { execute: t.mock.fn(async (input: string, _signal: AbortSignal): Promise<StepResult<string, 'blocked'>> => ({ decision: 'allow', output: input })) },
    records: { record: t.mock.fn((entry: StepRecord) => { entries.push(entry); }) },
    fetcher: { fetchURL: t.mock.fn(async (_url: string, _signal?: AbortSignal) => ({ ...page })) },
    incoming: {
      execute: t.mock.fn(async (_source: WebsiteFetchResult, _signal?: AbortSignal): Promise<StepResult<string>> => ({ decision: 'allow', output: 'Exact Markdown' })),
    },
  };
}

test('Given a sink that aborts during the incoming terminal write, when the core regains control, then no Markdown is released and both completed allowed records stay unchanged', async (t) => {
  const dependencies = operationDoubles(t);
  const controller = new AbortController();
  dependencies.records.record.mock.mockImplementation((entry) => {
    dependencies.entries.push(entry);
    if (entry.stepId === 'incoming.process_html') controller.abort(new Error('private-abort-reason'));
  });

  await assert.rejects(createFetchPage(dependencies)(url, context, executionContextOf(controller.signal)), { name: 'AbortError', message: 'Request cancelled' });

  assert.deepEqual(dependencies.entries.map(({ stepId, outcome }) => ({ stepId, outcome })), [
    { stepId: 'outgoing.observe_request', outcome: 'allowed' },
    { stepId: 'incoming.process_html', outcome: 'allowed' },
  ]);
  assert.equal(dependencies.incoming.execute.mock.callCount(), 1);
});

for (const mode of ['failure', 'success', 'cancelled', 'reporter_throws'] as const) {
  test(`Given a fetch ${mode}, when the protected operation finishes, then only noncancelled failures attempt one correlated safe diagnostic`, async (t) => {
    const dependencies = operationDoubles(t);
    const reports: unknown[] = [];
    const execution = executionContextOf();
    if (mode !== 'success') dependencies.fetcher.fetchURL.mock.mockImplementation(async () => {
      if (mode === 'cancelled') throw new DOMException('private-cancel', 'AbortError');
      throw Object.assign(new Error('private-message'), { code: 'ESECRETTOKEN', cause: new Error('private-cause') });
    });
    const operation = createFetchPage({ ...dependencies, reportFetchFailure: (failure) => {
      reports.push(failure);
      if (mode === 'reporter_throws') throw new Error('private-logger');
    } });
    if (mode === 'success') assert.equal((await operation(url, context, execution)).status, 'released');
    else await assert.rejects(operation(url, context, execution), { message: mode === 'cancelled' ? 'Request cancelled' : 'Page fetch failed' });
    assert.deepEqual(reports, mode === 'success' || mode === 'cancelled' ? [] : [{ category: 'unknown', phase: 'unknown', operationId: execution.operationId }]);
  });
}

test('Given a typed HTTP 429 failure with a private cause, when the protected operation fetches, then it keeps only the safe status and does not process HTML', async (t) => {
  const dependencies = operationDoubles(t);
  const failure = new WebsiteFetchHttpError(429, { cause: new Error('private-fetch-cause') });
  failure.message = 'private-renderer-message';
  dependencies.fetcher.fetchURL.mock.mockImplementation(async () => { throw failure; });

  await assert.rejects(createFetchPage(dependencies)(url, context, executionContextOf()), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.message, 'Page fetch failed: HTTP 429');
    assert.equal(error.cause, undefined);
    assert.doesNotMatch(JSON.stringify(error), /private-/);
    return true;
  });
  assert.equal(dependencies.fetcher.fetchURL.mock.callCount(), 1);
  assert.equal(dependencies.incoming.execute.mock.callCount(), 0);
});
