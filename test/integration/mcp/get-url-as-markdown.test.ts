import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import { createRequestContext } from '../../../src/auth/access-context.ts';
import { createGetURLAsMarkdown, type RendererSetupFailure } from '../../../src/mcp/get-url-as-markdown.ts';
import type { Ctx } from '../../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import { WebsiteFetchHttpError, WebsiteFetchLaunchError, type WebsiteFetchResult } from '../../../src/website-fetcher/website-fetcher.ts';

const url = 'https://source.example/article';
const page: WebsiteFetchResult = { requestedUrl: url, finalUrl: 'https://destination.example/final', html: '<p>Source</p>' };
const context = createRequestContext({
  user: { authority: 'https://synthetic.example/', subject: 'synthetic-user' },
  tenantId: 'synthetic-workspace',
  grants: [{ role: 'reader', permissions: ['product:access'] }],
});

describe('getURLAsMarkdown operation and access contract', () => {
  test('Given a trusted context without product access, when the operation is called, then fetch never starts', async (t) => {
    const fetchURL = t.mock.fn(async () => page);
    const process = t.mock.fn(async (source: WebsiteFetchResult): Promise<Ctx> => ({ ...source, removed: 0, skipped: 0, markdown: 'unused' }));
    const operation = createGetURLAsMarkdown({ fetcher: { fetchURL }, pipeline: { process } });
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
    const process = t.mock.fn(async (source: WebsiteFetchResult): Promise<Ctx> => ({ ...source, removed: 0, skipped: 0, markdown, title: 'Do not append' }));
    const signal = new AbortController().signal;
    const operation = createGetURLAsMarkdown({ fetcher: { fetchURL }, pipeline: { process } });

    assert.equal(await operation(requestedUrl, context, signal), markdown);

    assert.deepEqual(fetchURL.mock.calls[0].arguments, [requestedUrl, signal]);
    assert.deepEqual(process.mock.calls[0].arguments, [fetched, signal]);
    assert.deepEqual(fetched, { ...page, requestedUrl });
  });

  for (const invalid of ['', ' ', '/relative', 'not a URL', 'https://', 'ftp://example.com/', 'https://user:password@example.com/', 'http://user@example.com/']) {
    test(`Given invalid URL ${JSON.stringify(invalid)}, when the operation is called, then no fetch runs`, async (t) => {
      const dependencies = operationDoubles(t);

      await assert.rejects(createGetURLAsMarkdown(dependencies)(invalid, context, new AbortController().signal), {
        message: 'Invalid tool arguments',
      });

      assert.equal(dependencies.fetcher.fetchURL.mock.callCount(), 0);
      assert.equal(dependencies.pipeline.process.mock.callCount(), 0);
    });
  }

  for (const character of ['x', '😃']) {
    test(`Given an 8192 code-point URL with ${character}, when fetched, then the exact URL is accepted without truncation`, async (t) => {
      const prefix = 'https://example.com/';
      const boundedUrl = prefix + character.repeat(8192 - prefix.length);
      const dependencies = operationDoubles(t);
      const signal = new AbortController().signal;

      assert.equal(await createGetURLAsMarkdown(dependencies)(boundedUrl, context, signal), 'Exact Markdown');
      assert.deepEqual(dependencies.fetcher.fetchURL.mock.calls[0].arguments, [boundedUrl, signal]);
    });

    test(`Given an 8193 code-point URL with ${character}, when called, then no fetch runs`, async (t) => {
      const prefix = 'https://example.com/';
      const dependencies = operationDoubles(t);

      await assert.rejects(createGetURLAsMarkdown(dependencies)(prefix + character.repeat(8193 - prefix.length), context, new AbortController().signal), {
        message: 'Invalid tool arguments',
      });
      assert.equal(dependencies.fetcher.fetchURL.mock.callCount(), 0);
    });
  }

  test('Given a fetch failure, when it rejects, then only the safe fetch error is returned and processing never starts', async (t) => {
    const dependencies = operationDoubles(t);
    dependencies.fetcher.fetchURL.mock.mockImplementation(async () => { throw new Error('secret fetch cause'); });

    await assert.rejects(createGetURLAsMarkdown(dependencies)(url, context, new AbortController().signal), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, 'Page fetch failed');
      assert.equal(error.cause, undefined);
      return true;
    });
    assert.equal(dependencies.fetcher.fetchURL.mock.callCount(), 1);
    assert.equal(dependencies.pipeline.process.mock.callCount(), 0);
  });

  for (const [code, failure] of [['ENOENT', 'missing'], ['EACCES', 'cannot-start']] as const) {
    test(`Given a renderer that cannot start with ${code}, when the operation fetches, then only the safe fetch error is returned and the operator reporter gets one report with only the failure class and code`, async (t) => {
      const dependencies = operationDoubles(t);
      const launchFailure = new WebsiteFetchLaunchError(code, 'Lightpanda executable "/private/lightpanda" could not start.', {
        cause: new Error(`spawn /private/lightpanda ${code} fetch ${url}`),
      });
      dependencies.fetcher.fetchURL.mock.mockImplementation(async () => { throw launchFailure; });

      await assert.rejects(createGetURLAsMarkdown(dependencies)(url, context, new AbortController().signal), (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, 'Page fetch failed');
        assert.equal(error.cause, undefined);
        return true;
      });
      assert.deepEqual(dependencies.reportRendererSetupFailure.mock.calls.map((call) => call.arguments), [[{ failure, code }]]);
      assert.equal(dependencies.pipeline.process.mock.callCount(), 0);
    });
  }

  const otherFetchFailures = [
    ['an HTTP 404 error', new WebsiteFetchHttpError(404)],
    ['the readiness limit', new Error('Lightpanda readiness limit exceeded after 5000 ms')],
    ['the process timeout', Object.assign(new Error('Command failed'), { code: null, killed: true, signal: 'SIGTERM' })],
    ['a blocked destination', new Error('Fetch destination is not a public network address: 127.0.0.1')],
  ] as const;
  for (const [name, fetchFailure] of otherFetchFailures) {
    test(`Given ${name}, when the operation fetches, then only the safe fetch error is returned and the operator reporter gets no report`, async (t) => {
      const dependencies = operationDoubles(t);
      dependencies.fetcher.fetchURL.mock.mockImplementation(async () => { throw fetchFailure; });

      await assert.rejects(createGetURLAsMarkdown(dependencies)(url, context, new AbortController().signal), { message: 'Page fetch failed' });
      assert.equal(dependencies.reportRendererSetupFailure.mock.callCount(), 0);
    });
  }

  test('Given a renderer that cannot start and an operator reporter that throws, when the operation fetches, then the safe fetch error is still returned', async (t) => {
    const dependencies = operationDoubles(t);
    dependencies.fetcher.fetchURL.mock.mockImplementation(async () => { throw new WebsiteFetchLaunchError('ENOENT', 'Lightpanda executable was not found.'); });
    dependencies.reportRendererSetupFailure.mock.mockImplementation(() => { throw new Error('secret log failure'); });

    await assert.rejects(createGetURLAsMarkdown(dependencies)(url, context, new AbortController().signal), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, 'Page fetch failed');
      assert.equal(error.cause, undefined);
      return true;
    });
    assert.equal(dependencies.reportRendererSetupFailure.mock.callCount(), 1);
  });

  test('Given a thrown pipeline failure, when it rejects, then only the safe processing error is returned', async (t) => {
    const dependencies = operationDoubles(t);
    dependencies.pipeline.process.mock.mockImplementation(async () => { throw new Error('secret partial Markdown'); });

    await assert.rejects(createGetURLAsMarkdown(dependencies)(url, context, new AbortController().signal), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, 'Page processing failed');
      assert.equal(error.cause, undefined);
      return true;
    });
    assert.equal(dependencies.fetcher.fetchURL.mock.callCount(), 1);
  });

  for (const markdown of [undefined, null, 42, { text: 'must not serialize' }]) {
    test(`Given nonstring Markdown ${JSON.stringify(markdown)}, when the pipeline returns it, then the operation fails safely`, async (t) => {
      const dependencies = operationDoubles(t);
      dependencies.pipeline.process.mock.mockImplementation(async (source) => ({ ...source, removed: 0, skipped: 0, markdown }) as unknown as Ctx);

      await assert.rejects(createGetURLAsMarkdown(dependencies)(url, context, new AbortController().signal), { message: 'Page processing failed' });
    });
  }

  for (const result of [undefined, null]) {
    test(`Given an absent pipeline result ${result}, when processing returns, then the operation fails safely`, async (t) => {
      const dependencies = operationDoubles(t);
      dependencies.pipeline.process.mock.mockImplementation(async () => result as unknown as Ctx);

      await assert.rejects(createGetURLAsMarkdown(dependencies)(url, context, new AbortController().signal), { message: 'Page processing failed' });
    });
  }

  test('Given empty Markdown and warnings, when the pipeline completes, then the empty success is preserved', async (t) => {
    const dependencies = operationDoubles(t);
    dependencies.pipeline.process.mock.mockImplementation(async (source) => ({
      ...source, removed: 0, skipped: 0, markdown: '', warnings: ['HTML scan failed; remaining HTML withheld'],
    }));

    assert.equal(await createGetURLAsMarkdown(dependencies)(url, context, new AbortController().signal), '');
  });

  for (const html of ['x'.repeat(10 * 1024 * 1024 + 1), '😃'.repeat(10 * 1024 * 1024 / 4) + 'x']) {
    test(`Given HTML of ${Buffer.byteLength(html, 'utf8')} bytes and ${html.length} UTF-16 units, when fetched, then it fails before pipeline stages`, async (t) => {
      const dependencies = operationDoubles(t);
      dependencies.fetcher.fetchURL.mock.mockImplementation(async () => ({ ...page, html }));

      await assert.rejects(createGetURLAsMarkdown(dependencies)(url, context, new AbortController().signal), { message: 'Page processing failed' });

      assert.equal(dependencies.pipeline.process.mock.callCount(), 0);
    });
  }

  test('Given exactly 10 MiB of UTF-8 HTML, when fetched, then processing receives the complete input', async (t) => {
    const html = '😃'.repeat(10 * 1024 * 1024 / 4);
    const dependencies = operationDoubles(t);
    dependencies.fetcher.fetchURL.mock.mockImplementation(async () => ({ ...page, html }));

    assert.equal(await createGetURLAsMarkdown(dependencies)(url, context, new AbortController().signal), 'Exact Markdown');
    assert.equal(dependencies.pipeline.process.mock.calls[0].arguments[0].html, html);
  });

  test('Given cancellation before fetch, when called, then no collaborator runs and the cancellation cause is withheld', async (t) => {
    const dependencies = operationDoubles(t);
    const controller = new AbortController();
    controller.abort(new Error('secret cancellation reason'));

    await assert.rejects(createGetURLAsMarkdown(dependencies)(url, context, controller.signal), { name: 'AbortError', message: 'Request cancelled' });
    assert.equal(dependencies.fetcher.fetchURL.mock.callCount(), 0);
    assert.equal(dependencies.pipeline.process.mock.callCount(), 0);
  });

  for (const stage of ['fetch', 'pipeline']) {
    test(`Given an AbortError from ${stage}, when the signal has not yet changed, then cancellation is still classified safely`, async (t) => {
      const dependencies = operationDoubles(t);
      const abort = async (): Promise<never> => { throw new DOMException('secret abort details', 'AbortError'); };
      if (stage === 'fetch') dependencies.fetcher.fetchURL.mock.mockImplementation(abort);
      else dependencies.pipeline.process.mock.mockImplementation(abort);

      await assert.rejects(createGetURLAsMarkdown(dependencies)(url, context, new AbortController().signal), { name: 'AbortError', message: 'Request cancelled' });

      assert.equal(dependencies.pipeline.process.mock.callCount(), stage === 'fetch' ? 0 : 1);
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
          dependencies.pipeline.process.mock.mockImplementation(async (source) => { cancel(); return { ...source, removed: 0, skipped: 0, markdown: 'partial' }; });
        }

        await assert.rejects(createGetURLAsMarkdown(dependencies)(url, context, controller.signal), { name: 'AbortError', message: 'Request cancelled' });

        assert.equal(dependencies.fetcher.fetchURL.mock.callCount(), 1);
        assert.equal(dependencies.pipeline.process.mock.callCount(), stage === 'fetch' ? 0 : 1);
      });
    }
  }
});

function operationDoubles(t: TestContext) {
  return {
    fetcher: { fetchURL: t.mock.fn(async (_url: string, _signal?: AbortSignal) => ({ ...page })) },
    pipeline: {
      process: t.mock.fn(async (source: WebsiteFetchResult, _signal?: AbortSignal): Promise<Ctx> => ({
        ...source, removed: 0, skipped: 0, markdown: 'Exact Markdown',
      })),
    },
    reportRendererSetupFailure: t.mock.fn((_failure: RendererSetupFailure) => {}),
  };
}
