import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createHostedToolOperations, createToolOperations } from '../../../src/app/fetch-tool.ts';
import { createRequestContext } from '../../../src/accounts/identity/access-context.ts';
import { ObserveRequestStep } from '../../../src/pipelines/execution/observe-request-step.ts';
import { HtmlToMarkdownPipeline } from '../../../src/pipelines/html-processing/html-to-markdown-pipeline.ts';
import { RendererProcessDouble, controlledRenderer } from '../../support/doubles/website-fetcher/renderer-process-double.ts';
import { trustedAdRulesFile } from '../../support/fixtures/ad-rules.ts';
import { executionContextOf } from '../../support/fixtures/execution-context.ts';
import { openSearchSite } from '../../support/in-process/mcp-search-site.ts';
import { repositoryRoot } from '../../support/processes/module-paths.ts';

const environment = { AD_RULES_FILE: trustedAdRulesFile };
const logger = { info: () => {}, error: () => {} };
const context = createRequestContext({ user: { authority: 'acceptance', subject: 'reader' }, tenantId: 'tenant', grants: [{ role: 'reader', permissions: ['product:access'] }] });
const url = 'https://source.example/story';
const query = 'capacity';
const searchUrl = 'https://search.brave.com/search?q=capacity';
const article = '<html><body><main><p>The rendered article has enough words to keep this first paragraph.</p></main></body></html>';
const searchHtml = readFileSync(new URL('test/support/fixtures/search-engine/brave-results.html', repositoryRoot), 'utf8');
type Tools = ReturnType<typeof createHostedToolOperations>;
type Tool = 'fetch' | 'search';

function invoke(tools: Tools, tool: Tool, signal = new AbortController().signal) {
  return tools[tool](tool === 'fetch' ? url : query, context, executionContextOf(signal));
}

function gate() {
  const entered = Promise.withResolvers<void>();
  const held = Promise.withResolvers<void>();
  return { enter: entered.resolve, entered: entered.promise, held: held.promise, release: held.resolve };
}

function assertReleased(result: unknown, tool: Tool) {
  const markdown = tool === 'fetch' ? result : (result as { status: string; markdown: string }).markdown;
  if (tool === 'search') assert.equal((result as { status: string }).status, 'released');
  assert.equal(typeof markdown, 'string');
  assert.ok((markdown as string).trim().length > 0);
}

for (const firstTool of ['fetch', 'search'] as const) {
  const peer = firstTool === 'fetch' ? 'search' : 'fetch';
  for (const stage of ['outgoing', 'incoming'] as const) {
    for (const outcome of ['success', 'failure', 'abort'] as const) {
      test(`Given hosted ${firstTool} held in ${stage}, when ${peer} arrives before ${outcome} settles, then it gets busy, cancelled peers get cancellation, and the next operation works`, { timeout: 5_000 }, async (t) => {
        const renderer = RendererProcessDouble.install(t);
        renderer.serve(url, { finalUrl: url, html: article });
        renderer.serve(searchUrl, { finalUrl: searchUrl, html: searchHtml });
        const tools = createHostedToolOperations(environment, logger);
        const barrier = gate();
        const controller = new AbortController();
        let held = false;
        if (stage === 'outgoing') {
          const execute = ObserveRequestStep.prototype.execute;
          t.mock.method(ObserveRequestStep.prototype, 'execute', async function (this: ObserveRequestStep, ...args: Parameters<typeof execute>) {
            if (!held) {
              held = true;
              barrier.enter();
              await barrier.held;
              if (outcome === 'failure') throw new Error('Outgoing failed');
            }
            return execute.apply(this, args);
          });
        } else {
          const process = HtmlToMarkdownPipeline.prototype.process;
          t.mock.method(HtmlToMarkdownPipeline.prototype, 'process', async function (this: HtmlToMarkdownPipeline, ...args: Parameters<typeof process>) {
            if (!held) {
              held = true;
              barrier.enter();
              await barrier.held;
              if (outcome === 'failure') throw new Error('Incoming failed');
            }
            return process.apply(this, args);
          });
        }
        t.after(() => barrier.release());
        const first = invoke(tools, firstTool, controller.signal);
        const settled = first.then((value) => ({ value }), (error: Error) => ({ error }));
        await barrier.entered;
        if (outcome === 'abort') controller.abort();
        await assert.rejects(invoke(tools, peer), /Server busy\. Try again later\./);
        const cancelled = new AbortController();
        cancelled.abort();
        await assert.rejects(invoke(tools, peer, cancelled.signal), { name: 'AbortError' });
        assert.equal(renderer.launches.length, stage === 'outgoing' ? 0 : 1);
        barrier.release();
        const result = await settled;
        if (outcome === 'success') {
          assert.ok('value' in result);
          assertReleased(result.value, firstTool);
        } else {
          assert.ok('error' in result);
          if (outcome === 'abort') assert.equal(result.error.name, 'AbortError');
        }
        assertReleased(await invoke(tools, peer), peer);
      });
    }
  }

  for (const outcome of ['success', 'failure', 'abort'] as const) {
    test(`Given hosted ${firstTool} rendering, when ${peer} arrives during ${outcome} and held renderer cleanup, then the slot stays busy until renderer settlement`, { timeout: 5_000 }, async (t) => {
      const renderer = controlledRenderer(t);
      const tools = createHostedToolOperations(environment, logger);
      const controller = new AbortController();
      const response = (tool: Tool) => JSON.stringify({ url: tool === 'fetch' ? url : searchUrl, http_status: 200, content: tool === 'fetch' ? article : searchHtml, error: null });
      t.after(() => renderer.finish(null, response(firstTool), ''));
      const first = invoke(tools, firstTool, controller.signal);
      const settled = first.then((value) => ({ value }), (error: Error) => ({ error }));
      await renderer.launched;
      if (outcome === 'abort') {
        controller.abort();
        assert.deepEqual(renderer.child.signals, ['SIGKILL']);
      }
      await assert.rejects(invoke(tools, peer), /Server busy\. Try again later\./);
      const cancelled = new AbortController();
      cancelled.abort();
      await assert.rejects(invoke(tools, peer, cancelled.signal), { name: 'AbortError' });
      assert.equal(renderer.execute.mock.callCount(), 1);
      renderer.finish(outcome === 'failure' ? Object.assign(new Error('Renderer failed'), { code: 22 }) : null, outcome === 'failure' ? JSON.stringify({ url, http_status: 404, content: '', error: 'HttpError' }) : response(firstTool), '');
      const result = await settled;
      if (outcome === 'success') {
        assert.ok('value' in result);
        assertReleased(result.value, firstTool);
      } else {
        assert.ok('error' in result);
        if (outcome === 'abort') assert.equal(result.error.name, 'AbortError');
      }
      const next = invoke(tools, peer);
      while (renderer.execute.mock.callCount() < 2) {
        t.signal.throwIfAborted();
        await new Promise<void>((resolve) => setImmediate(resolve));
      }
      renderer.finish(null, response(peer), '');
      assertReleased(await next, peer);
    });
  }
}

for (const deployment of ['separate hosted applications', 'self-hosted operations'] as const) {
  test(`Given ${deployment}, when fetch and search overlap, then both enter rendering and complete`, { timeout: 5_000 }, async (t) => {
    const renderer = RendererProcessDouble.install(t);
    renderer.serve(url, { finalUrl: url, html: article });
    renderer.serve(searchUrl, { finalUrl: searchUrl, html: searchHtml });
    const first = deployment === 'self-hosted operations' ? createToolOperations(environment, logger) : createHostedToolOperations(environment, logger);
    const second = deployment === 'self-hosted operations' ? first : createHostedToolOperations(environment, logger);
    const barrier = gate();
    let arrivals = 0;
    const process = HtmlToMarkdownPipeline.prototype.process;
    t.mock.method(HtmlToMarkdownPipeline.prototype, 'process', async function (this: HtmlToMarkdownPipeline, ...args: Parameters<typeof process>) {
      arrivals++;
      if (arrivals === 2) barrier.enter();
      await barrier.held;
      return process.apply(this, args);
    });
    t.after(() => barrier.release());
    const fetch = invoke(first, 'fetch');
    const search = invoke(second, 'search');
    await barrier.entered;
    assert.equal(renderer.launches.length, 2);
    barrier.release();
    assertReleased(await fetch, 'fetch');
    assertReleased(await search, 'search');
  });
}


for (const firstTool of ['fetch', 'search'] as const) {
  test(`Given public hosted ${firstTool} rendering, when its peer is called and the first client cancels, then capacity stays held through cleanup and the peer can recover`, { timeout: 5_000 }, async (t) => {
    const renderer = controlledRenderer(t);
    const site = await openSearchSite(t, '2026-07-28', 'hosted');
    const peer = firstTool === 'fetch' ? 'search' : 'fetch';
    const controller = new AbortController();
    const call = (tool: Tool, signal?: AbortSignal) => site.client.callTool({ name: tool === 'fetch' ? 'getURLAsMarkdown' : 'search', arguments: tool === 'fetch' ? { url, reason: 'Read source' } : { query, reason: 'Find source' } }, { signal });
    const response = (tool: Tool) => JSON.stringify({ url: tool === 'fetch' ? url : searchUrl, http_status: 200, content: tool === 'fetch' ? article : searchHtml, error: null });
    t.after(() => renderer.finish(null, response(firstTool), ''));
    const first = call(firstTool, controller.signal).catch(() => undefined);
    await renderer.launched;
    assert.deepEqual((await call(peer)).content, [{ type: 'text', text: 'Server busy. Try again later.' }]);
    controller.abort();
    while (renderer.child.signals.length === 0) {
      t.signal.throwIfAborted();
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    assert.deepEqual(renderer.child.signals, ['SIGKILL']);
    assert.deepEqual((await call(peer)).content, [{ type: 'text', text: 'Server busy. Try again later.' }]);
    assert.equal(renderer.execute.mock.callCount(), 1);
    renderer.finish(null, response(firstTool), '');
    await first;
    while (!site.completions().some((record) => record.status === 'cancelled')) {
      t.signal.throwIfAborted();
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    const next = call(peer);
    while (renderer.execute.mock.callCount() < 2) {
      t.signal.throwIfAborted();
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    renderer.finish(null, response(peer), '');
    const result = await next;
    assert.notEqual(result.isError, true);
    assert.equal(site.completions().filter((record) => record.status === 'cancelled').length, 1);
  });
}
