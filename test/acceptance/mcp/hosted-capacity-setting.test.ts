import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test, type TestContext } from 'node:test';
import { HtmlToMarkdownPipeline } from '../../../src/pipelines/html-processing/html-to-markdown-pipeline.ts';
import { RendererProcessDouble } from '../../support/doubles/website-fetcher/renderer-process-double.ts';
import { openSearchSite } from '../../support/in-process/mcp-search-site.ts';
import { repositoryRoot } from '../../support/processes/module-paths.ts';

// The hosted edition reads OPERATION_CAPACITY when it starts. These specifications call the public MCP tools of a
// hosted site with the production operation factory and the renderer double. Each call that runs stops in incoming
// processing until the test settles it, so the test controls how many calls run at the same time.

const url = 'https://source.example/story';
const query = 'capacity';
const searchUrl = 'https://search.brave.com/search?q=capacity';
const article = '<html><body><main><p>The rendered article has enough words to keep this first paragraph.</p></main></body></html>';
const searchHtml = readFileSync(new URL('test/support/fixtures/search-engine/brave-results.html', repositoryRoot), 'utf8');
const busy = [{ type: 'text', text: 'Server busy. Try again later.' }];

type Tool = 'fetch' | 'search';
type Site = Awaited<ReturnType<typeof openSearchSite>>;
type ToolResult = Awaited<ReturnType<Site['client']['callTool']>>;
type HeldWork = ReturnType<typeof holdIncomingWork>;

function serveSourcePages(t: TestContext): void {
  const renderer = RendererProcessDouble.install(t);
  renderer.serve(url, { finalUrl: url, html: article });
  renderer.serve(searchUrl, { finalUrl: searchUrl, html: searchHtml });
}

// A held call continues with the real processing when the test settles it with success. A failure gives the
// processing failure of its tool.
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

function call(site: Site, tool: Tool, signal?: AbortSignal): Promise<ToolResult> {
  const params = tool === 'fetch'
    ? { name: 'getURLAsMarkdown', arguments: { url, reason: 'Read the source' } }
    : { name: 'search', arguments: { query, reason: 'Find the source' } };
  return site.client.callTool(params, { signal });
}

async function nextTurn(t: TestContext): Promise<void> {
  t.signal.throwIfAborted();
  await new Promise<void>((resolve) => setImmediate(resolve));
}

// A call runs when incoming processing holds it. A call that returns before that point did not run.
async function startHeld(t: TestContext, site: Site, work: HeldWork, tool: Tool, signal?: AbortSignal): Promise<{ result: Promise<ToolResult> }> {
  const position = work.count() + 1;
  let returned = false;
  const result = call(site, tool, signal);
  result.then(() => { returned = true; }, () => { returned = true; });
  while (work.count() < position) {
    assert.equal(returned, false, `Call ${position} returned before it ran`);
    await nextTurn(t);
  }
  return { result };
}

function statuses(site: Site): unknown[] {
  return site.completions().map((record) => record.status);
}

async function untilCompletion(t: TestContext, site: Site, status: string): Promise<void> {
  while (!statuses(site).includes(status)) await nextTurn(t);
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
    serveSourcePages(t);
    const work = holdIncomingWork(t);
    const site = await openSearchSite(t, '2026-07-28', 'hosted', { OPERATION_CAPACITY: '2' });
    const cancel = new AbortController();

    const fetch = await startHeld(t, site, work, 'fetch', cancel.signal);
    const fetchOutcome = fetch.result.then((value) => ({ value }), (error: Error) => ({ error }));
    const search = await startHeld(t, site, work, 'search');
    assertRefusedAsBusy(await call(site, 'fetch'));
    assert.deepEqual(statuses(site), ['busy']);

    if (outcome === 'abort') {
      cancel.abort();
      while (work.signal(0)?.aborted !== true) await nextTurn(t);
    }
    work.settle(0, outcome === 'failure' ? 'failure' : 'success');
    await untilCompletion(t, site, { success: 'success', failure: 'processing_failed', abort: 'cancelled' }[outcome]);
    const next = await startHeld(t, site, work, 'search');

    work.settleAll();
    assertReleased(await search.result);
    assertReleased(await next.result);
    const settled = await fetchOutcome;
    if (outcome === 'success') assert.ok('value' in settled && settled.value.isError !== true);
    if (outcome === 'failure') assert.ok('value' in settled && settled.value.isError === true);
    if (outcome === 'abort') assert.ok('error' in settled);
    assert.equal(statuses(site).filter((status) => status === 'busy').length, 1);
  });
}

test('Given no OPERATION_CAPACITY, when ten held fetch and search calls arrive, then all ten run and the eleventh gets Server busy with completion busy', { timeout: 20_000 }, async (t) => {
  serveSourcePages(t);
  const work = holdIncomingWork(t);
  const site = await openSearchSite(t, '2026-07-28', 'hosted');
  const tools: Tool[] = Array.from({ length: 10 }, (_, index) => (index % 2 === 0 ? 'fetch' : 'search'));

  const running = [];
  for (const tool of tools) running.push(await startHeld(t, site, work, tool));
  assertRefusedAsBusy(await call(site, 'search'));
  assert.deepEqual(statuses(site), ['busy']);

  work.settleAll();
  for (const { result } of running) assertReleased(await result);
  assert.deepEqual(statuses(site).toSorted(), ['busy', ...Array.from({ length: 10 }, () => 'success')]);
});
