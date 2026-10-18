import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import { createRequestContext } from '../../../src/auth/access-context.ts';
import { createFetchPage } from '../../../src/page-fetch/fetch-page.ts';
import type { WebsiteFetchResult } from '../../../src/website-fetcher/website-fetcher.ts';

const url = 'https://source.example/article';
const page: WebsiteFetchResult = { requestedUrl: url, finalUrl: 'https://destination.example/final', html: '<p>Source</p>' };
const context = createRequestContext({
  user: { authority: 'https://synthetic.example/', subject: 'synthetic-user' },
  tenantId: 'synthetic-workspace',
  grants: [{ role: 'reader', permissions: ['product:access'] }],
});

describe('Protected neutral page fetch operation and access contract', () => {
  test('Given a trusted context without product access, when the operation is called, then fetch never starts', async (t) => {
    const fetchURL = t.mock.fn(async () => page);
    const process = t.mock.fn(async (_source: WebsiteFetchResult) => 'unused');
    const operation = createFetchPage({ fetcher: { fetchURL }, processor: { process } });
    const denied = createRequestContext({ user: context.user, tenantId: context.tenantId, grants: [] });

    await assert.rejects(operation(url, denied, new AbortController().signal), { name: 'AccessDeniedError', message: 'Access denied' });

    assert.equal(fetchURL.mock.callCount(), 0);
    assert.equal(process.mock.callCount(), 0);
  });

  test('Given a spelled URL and redirect metadata, when the operation completes, then collaborators receive them unchanged and return exact Markdown', async (t) => {
    const requestedUrl = 'HTTPS://Source.Example:443/a%2fb?q=%2f#Part';
    const fetched = { ...page, requestedUrl };
    const markdown = '\n# Exact title\n\nBody 😃\n';
    const fetchURL = t.mock.fn(async () => fetched);
    const process = t.mock.fn(async (_source: WebsiteFetchResult) => markdown);
    const signal = new AbortController().signal;
    const operation = createFetchPage({ fetcher: { fetchURL }, processor: { process } });

    assert.deepEqual(await operation(requestedUrl, context, signal), { status: 'released', markdown });

    assert.deepEqual(fetchURL.mock.calls[0].arguments, [requestedUrl, signal]);
    assert.deepEqual(process.mock.calls[0].arguments, [fetched, signal]);
    assert.deepEqual(fetched, { ...page, requestedUrl });
  });

  for (const invalid of ['', ' ', '/relative', 'not a URL', 'https://', 'ftp://example.com/', 'https://user:password@example.com/', 'http://user@example.com/']) {
    test(`Given invalid URL ${JSON.stringify(invalid)}, when the operation is called, then no fetch runs`, async (t) => {
      const dependencies = operationDoubles(t);

      await assert.rejects(createFetchPage(dependencies)(invalid, context, new AbortController().signal), {
        message: 'Invalid tool arguments',
      });

      assert.equal(dependencies.fetcher.fetchURL.mock.callCount(), 0);
      assert.equal(dependencies.processor.process.mock.callCount(), 0);
    });
  }

  for (const character of ['x', '😃']) {
    test(`Given an 8192 code-point URL with ${character}, when fetched, then the exact URL is accepted without truncation`, async (t) => {
      const prefix = 'https://example.com/';
      const boundedUrl = prefix + character.repeat(8192 - prefix.length);
      const dependencies = operationDoubles(t);
      const signal = new AbortController().signal;

      assert.deepEqual(await createFetchPage(dependencies)(boundedUrl, context, signal), { status: 'released', markdown: 'Exact Markdown' });
      assert.deepEqual(dependencies.fetcher.fetchURL.mock.calls[0].arguments, [boundedUrl, signal]);
    });

    test(`Given an 8193 code-point URL with ${character}, when called, then no fetch runs`, async (t) => {
      const prefix = 'https://example.com/';
      const dependencies = operationDoubles(t);

      await assert.rejects(createFetchPage(dependencies)(prefix + character.repeat(8193 - prefix.length), context, new AbortController().signal), {
        message: 'Invalid tool arguments',
      });
      assert.equal(dependencies.fetcher.fetchURL.mock.callCount(), 0);
    });
  }

  test('Given a fetch failure, when it rejects, then only the safe fetch error is returned and processing never starts', async (t) => {
    const dependencies = operationDoubles(t);
    dependencies.fetcher.fetchURL.mock.mockImplementation(async () => { throw new Error('secret fetch cause'); });

    await assert.rejects(createFetchPage(dependencies)(url, context, new AbortController().signal), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, 'Page fetch failed');
      assert.equal(error.cause, undefined);
      return true;
    });
    assert.equal(dependencies.fetcher.fetchURL.mock.callCount(), 1);
    assert.equal(dependencies.processor.process.mock.callCount(), 0);
  });

  test('Given a thrown processor failure, when it rejects, then only the safe processing error is returned', async (t) => {
    const dependencies = operationDoubles(t);
    dependencies.processor.process.mock.mockImplementation(async () => { throw new Error('secret partial Markdown'); });

    await assert.rejects(createFetchPage(dependencies)(url, context, new AbortController().signal), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, 'Page processing failed');
      assert.equal(error.cause, undefined);
      return true;
    });
    assert.equal(dependencies.fetcher.fetchURL.mock.callCount(), 1);
  });

  test('Given empty processed Markdown, when the fetch completes, then the released outcome keeps exact empty text', async (t) => {
    const dependencies = operationDoubles(t);
    dependencies.processor.process.mock.mockImplementation(async () => '');

    assert.deepEqual(await createFetchPage(dependencies)(url, context, new AbortController().signal), { status: 'released', markdown: '' });
  });

  test('Given cancellation before fetch, when called, then no collaborator runs and the cancellation cause is withheld', async (t) => {
    const dependencies = operationDoubles(t);
    const controller = new AbortController();
    controller.abort(new Error('secret cancellation reason'));

    await assert.rejects(createFetchPage(dependencies)(url, context, controller.signal), { name: 'AbortError', message: 'Request cancelled' });
    assert.equal(dependencies.fetcher.fetchURL.mock.callCount(), 0);
    assert.equal(dependencies.processor.process.mock.callCount(), 0);
  });

  for (const stage of ['fetch', 'processor']) {
    test(`Given an AbortError from ${stage}, when the signal has not yet changed, then cancellation is still classified safely`, async (t) => {
      const dependencies = operationDoubles(t);
      const abort = async (): Promise<never> => { throw new DOMException('secret abort details', 'AbortError'); };
      if (stage === 'fetch') dependencies.fetcher.fetchURL.mock.mockImplementation(abort);
      else dependencies.processor.process.mock.mockImplementation(abort);

      await assert.rejects(createFetchPage(dependencies)(url, context, new AbortController().signal), { name: 'AbortError', message: 'Request cancelled' });

      assert.equal(dependencies.processor.process.mock.callCount(), stage === 'fetch' ? 0 : 1);
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
          dependencies.processor.process.mock.mockImplementation(async () => { cancel(); return 'partial'; });
        }

        await assert.rejects(createFetchPage(dependencies)(url, context, controller.signal), { name: 'AbortError', message: 'Request cancelled' });

        assert.equal(dependencies.fetcher.fetchURL.mock.callCount(), 1);
        assert.equal(dependencies.processor.process.mock.callCount(), stage === 'fetch' ? 0 : 1);
      });
    }
  }
});

function operationDoubles(t: TestContext) {
  return {
    fetcher: { fetchURL: t.mock.fn(async (_url: string, _signal?: AbortSignal) => ({ ...page })) },
    processor: {
      process: t.mock.fn(async (_source: WebsiteFetchResult, _signal?: AbortSignal) => 'Exact Markdown'),
    },
  };
}
