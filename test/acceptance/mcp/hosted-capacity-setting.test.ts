import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test, type TestContext } from 'node:test';
import { HtmlToMarkdownPipeline } from '../../../src/pipelines/html-processing/html-to-markdown-pipeline.ts';
import { RendererProcessDouble } from '../../support/doubles/website-fetcher/renderer-process-double.ts';
import { openSearchSiteFor } from '../../support/in-process/mcp-search-site.ts';
import { repositoryRoot } from '../../support/processes/module-paths.ts';

const url = 'https://source.example/story';
const query = 'capacity';
const searchUrl = 'https://search.brave.com/search?q=capacity';
const article = '<html><body><main><p>The rendered article has enough words to keep this first paragraph.</p></main></body></html>';
const searchHtml = readFileSync(new URL('test/support/fixtures/search-engine/brave-results.html', repositoryRoot), 'utf8');
const busy = [{ type: 'text', text: 'Server busy. Try again later.' }];

type Tool = 'fetch' | 'search';
type ToolResult = Awaited<ReturnType<Awaited<ReturnType<typeof openSearchSiteFor>>['client']['callTool']>>;

async function nextTurn(t: TestContext): Promise<void> {
  t.signal.throwIfAborted();
  await new Promise<void>((resolve) => setImmediate(resolve));
}

function holdIncomingWork(t: TestContext) {
  const held: Array<{ signal?: AbortSignal; gate: PromiseWithResolvers<'success' | 'failure'> }> = [];
  const process = HtmlToMarkdownPipeline.prototype.process;
  t.mock.method(HtmlToMarkdownPipeline.prototype, 'process', async function (this: HtmlToMarkdownPipeline, ...args: Parameters<typeof process>) {
    const gate = Promise.withResolvers<'success' | 'failure'>();
    held.push({ signal: args[1], gate });
    if (await gate.promise === 'failure') throw new Error('Incoming failed');
    return process.apply(this, args);
  });
  const settleAll = (): void => { for (const call of held) call.gate.resolve('success'); };
  t.after(settleAll);
  return {
    count: (): number => held.length,
    signal: (index: number): AbortSignal | undefined => held[index]?.signal,
    settle: (index: number, outcome: 'success' | 'failure'): void => held[index]?.gate.resolve(outcome),
    settleAll,
  };
}

async function openHeldSite(t: TestContext, settings: Readonly<Record<string, string>> = {}) {
  const renderer = RendererProcessDouble.install(t);
  renderer.serve(url, { finalUrl: url, html: article });
  renderer.serve(searchUrl, { finalUrl: searchUrl, html: searchHtml });
  const work = holdIncomingWork(t);
  const site = await openSearchSiteFor(t, '2026-07-28', { DEPLOYMENT: 'hosted', ...settings });
  const call = (tool: Tool, signal?: AbortSignal): Promise<ToolResult> => site.client.callTool(tool === 'fetch'
    ? { name: 'getURLAsMarkdown', arguments: { url, reason: 'Read the source' } }
    : { name: 'search', arguments: { query, reason: 'Find the source' } }, { signal });
  const statuses = (): unknown[] => site.completions().map((record) => record.status);
  return {
    work,
    call,
    statuses,
    // A call runs when incoming processing holds it. A call that returns before that point did not run.
    async start(tool: Tool, signal?: AbortSignal): Promise<{ result: Promise<ToolResult> }> {
      const position = work.count() + 1;
      let returned = false;
      const result = call(tool, signal);
      result.then(() => { returned = true; }, () => { returned = true; });
      while (work.count() < position) {
        assert.equal(returned, false, `Call ${position} returned before it ran`);
        await nextTurn(t);
      }
      return { result };
    },
    async untilCompletion(status: string): Promise<void> {
      while (!statuses().includes(status)) await nextTurn(t);
    },
  };
}

function assertRefusedAsBusy(result: ToolResult): void {
  assert.equal(result.isError, true);
  assert.deepEqual(result.content, busy);
}

function assertReleased(result: ToolResult): void {
  assert.notEqual(result.isError, true, JSON.stringify(result));
  const [entry] = result.content as Array<{ type: string; text: string }>;
  assert.equal(entry?.type, 'text');
  assert.ok(entry.text.trim().length > 0);
}

for (const outcome of ['success', 'failure', 'abort'] as const) {
  test(`Given OPERATION_CAPACITY=2 and a held fetch and a held search, when a third call arrives and the held fetch then settles with ${outcome}, then the third call gets Server busy with completion busy and a new call runs`, { timeout: 10_000 }, async (t) => {
    const site = await openHeldSite(t, { OPERATION_CAPACITY: '2' });
    const cancel = new AbortController();

    const fetch = await site.start('fetch', cancel.signal);
    const fetchOutcome = fetch.result.then((value) => ({ value }), (error: Error) => ({ error }));
    const search = await site.start('search');
    assertRefusedAsBusy(await site.call('fetch'));
    assert.deepEqual(site.statuses(), ['busy']);

    if (outcome === 'abort') {
      cancel.abort();
      while (site.work.signal(0)?.aborted !== true) await nextTurn(t);
    }
    site.work.settle(0, outcome === 'failure' ? 'failure' : 'success');
    await site.untilCompletion({ success: 'success', failure: 'processing_failed', abort: 'cancelled' }[outcome]);
    const next = await site.start('search');

    site.work.settleAll();
    assertReleased(await search.result);
    assertReleased(await next.result);
    const settled = await fetchOutcome;
    if (outcome === 'success') assert.ok('value' in settled && settled.value.isError !== true);
    if (outcome === 'failure') assert.ok('value' in settled && settled.value.isError === true);
    if (outcome === 'abort') assert.ok('error' in settled);
    assert.equal(site.statuses().filter((status) => status === 'busy').length, 1);
  });
}

test('Given no OPERATION_CAPACITY, when ten held fetch and search calls arrive, then all ten run and the eleventh gets Server busy with completion busy', { timeout: 20_000 }, async (t) => {
  const site = await openHeldSite(t);
  const tools: Tool[] = Array.from({ length: 10 }, (_, index) => (index % 2 === 0 ? 'fetch' : 'search'));

  const running = [];
  for (const tool of tools) running.push(await site.start(tool));
  assertRefusedAsBusy(await site.call('search'));
  assert.deepEqual(site.statuses(), ['busy']);

  site.work.settleAll();
  for (const { result } of running) assertReleased(await result);
  assert.deepEqual(site.statuses().toSorted(), ['busy', ...Array.from({ length: 10 }, () => 'success')]);
});
