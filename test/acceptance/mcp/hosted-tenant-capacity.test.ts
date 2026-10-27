import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test, type TestContext } from 'node:test';
import { HtmlToMarkdownPipeline } from '../../../src/pipelines/html-processing/html-to-markdown-pipeline.ts';
import { RendererProcessDouble } from '../../support/doubles/website-fetcher/renderer-process-double.ts';
import { openTenantSite } from '../../support/in-process/tenant-site.ts';
import { repositoryRoot } from '../../support/processes/module-paths.ts';

// The capacity of the hosted image in the tenant role (SO-03): the setting OPERATION_CAPACITY of SO-01a applies in
// the tenant, which reads the value that the provisioner sets (5 for a free tenant, 10 for a team tenant, D-15). The
// test plays the gateway of the control plane, and each call that runs stops in incoming processing until it settles.

const url = 'https://source.example/story';
const article = '<html><body><main><p>The rendered article has enough words to keep this first paragraph.</p></main></body></html>';
const searchUrl = 'https://search.brave.com/search?q=capacity';
const searchHtml = readFileSync(new URL('test/support/fixtures/search-engine/brave-results.html', repositoryRoot), 'utf8');
const fetchCall = { name: 'getURLAsMarkdown', arguments: { url, reason: 'Read the source' } };
const searchCall = { name: 'search', arguments: { query: 'capacity', reason: 'Find the source' } };
const busy = [{ type: 'text', text: 'Server busy. Try again later.' }];

type Client = Awaited<ReturnType<Awaited<ReturnType<typeof openTenantSite>>['connect']>>;
type ToolResult = Awaited<ReturnType<Client['callTool']>>;

async function nextTurn(t: TestContext): Promise<void> {
  t.signal.throwIfAborted();
  await new Promise<void>((resolve) => setImmediate(resolve));
}

// Holds each call that runs in incoming processing until settleAll, so the test controls how many calls run.
function holdIncomingWork(t: TestContext) {
  const held: Array<PromiseWithResolvers<void>> = [];
  const process = HtmlToMarkdownPipeline.prototype.process;
  t.mock.method(HtmlToMarkdownPipeline.prototype, 'process', async function (this: HtmlToMarkdownPipeline, ...args: Parameters<typeof process>) {
    const gate = Promise.withResolvers<void>();
    held.push(gate);
    await gate.promise;
    return process.apply(this, args);
  });
  const settleAll = (): void => { for (const gate of held) gate.resolve(); };
  t.after(settleAll);
  return {
    settleAll,
    // Starts fetch and search calls in turn; each call runs before the next one starts.
    async startCalls(client: Client, count: number): Promise<Array<Promise<ToolResult>>> {
      const running: Array<Promise<ToolResult>> = [];
      for (let index = 0; index < count; index += 1) {
        running.push(client.callTool(index % 2 === 0 ? fetchCall : searchCall));
        while (held.length < index + 1) await nextTurn(t);
      }
      return running;
    },
  };
}

async function openHeldTenant(t: TestContext, settings: Readonly<Record<string, string>> = {}) {
  const site = await openTenantSite(t, settings);
  const renderer = RendererProcessDouble.install(t);
  renderer.serve(url, { finalUrl: url, html: article });
  renderer.serve(searchUrl, { finalUrl: searchUrl, html: searchHtml });
  return { site, work: holdIncomingWork(t), client: await site.connect(await site.token()) };
}

function assertRefusedAsBusy(result: ToolResult): void {
  assert.equal(result.isError, true);
  assert.deepEqual(result.content, busy);
}

test('Given OPERATION_CAPACITY=5 and 5 running calls, when a 6th call arrives, then it gets Server busy with completion busy and the relay receives its busy event', { timeout: 30_000 }, async (t) => {
  const { site, work, client } = await openHeldTenant(t, { OPERATION_CAPACITY: '5' });
  const running = await work.startCalls(client, 5);

  assertRefusedAsBusy(await client.callTool(fetchCall));
  await site.relay.untilReceived(1);

  assert.deepEqual(site.relay.received.map(({ event }) => event.status), ['busy']);
  assert.deepEqual(site.completions().map(({ status }) => status), ['busy']);
  work.settleAll();
  for (const result of running) assert.notEqual((await result).isError, true);
  await site.relay.untilReceived(6);
  assert.deepEqual(site.relay.received.map(({ event }) => event.status).toSorted(), ['busy', 'success', 'success', 'success', 'success', 'success']);
});

test('Given no OPERATION_CAPACITY and 10 running calls, when an 11th call arrives, then it gets Server busy: the default stays 10', { timeout: 30_000 }, async (t) => {
  const { site, work, client } = await openHeldTenant(t);
  const running = await work.startCalls(client, 10);

  assertRefusedAsBusy(await client.callTool(fetchCall));

  assert.deepEqual(site.completions().map(({ status }) => status), ['busy']);
  work.settleAll();
  for (const result of running) assert.notEqual((await result).isError, true);
});
