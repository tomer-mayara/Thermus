import { readFileSync } from 'node:fs';
import { repositoryRoot } from '../../support/processes/module-paths.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { connectMcpClient } from '../../support/drivers/mcp/mcp-sdk-client.ts';
import { HtmlToMarkdownPipeline } from '../../../src/pipelines/html-processing/html-to-markdown-pipeline.ts';
import { incomingPageCases } from '../../support/fixtures/incoming-pages.ts';
import { mcpProtocolEras } from '../../support/drivers/mcp/mcp-protocol-eras.ts';
import { searchToolInputSchema } from '../../../src/interfaces/mcp/search-tool-schema.ts';
import { fetchToolInputSchema } from '../../../src/interfaces/mcp/fetch-tool-schema.ts';
import { RendererProcessDouble, controlledRenderer } from '../../support/doubles/website-fetcher/renderer-process-double.ts';
import { mcpRequest, rpcResult } from '../../support/drivers/mcp/mcp-http-request.ts';
import { openHostedFetchSite } from '../../support/in-process/hosted-fetch-site.ts';
import { generatedOperationIdPattern } from '../../support/fixtures/execution-context.ts';
import { stepRecordsIn } from '../../support/drivers/operator-log.ts';

const url = 'https://source.example/story?private-query=yes#private-fragment';
const reason = 'Read the page for this task';
const html = '<html><body><main><h1>Hosted story</h1><p>The rendered article has enough words to keep this first paragraph.</p><div hidden>private-hidden-text</div></main></body></html>';
const markdown = 'The rendered article has enough words to keep this first paragraph.';
const renderedOutput = JSON.stringify({ url, http_status: 200, content: html, error: null });
const params = { name: 'getURLAsMarkdown', arguments: { url, reason } };
// The busy cases show the refusal of one hosted slot, so they set the capacity to one call.
const oneSlot = { OPERATION_CAPACITY: '1' };

test('Given production hosted composition with trusted rules and a valid Connect User, when the user lists and calls the tool, then cleaned Markdown and one allowed outgoing and incoming records join the completion ID, and missing or revoked access is refused before rendering', { timeout: 30_000 }, async (t) => {
  const site = await openHostedFetchSite(t);
  const renderer = RendererProcessDouble.install(t);
  renderer.serve(url, { finalUrl: url, html });
  const listed = await rpcResult(await site.application.handle(mcpRequest({ url: site.config.mcpResourceUrl, method: 'tools/list', token: site.token })));
  assert.deepEqual((listed.tools as Array<{ name: string; inputSchema: unknown }>).map(({ name, inputSchema }) => ({ name, inputSchema })), [{ name: params.name, inputSchema: fetchToolInputSchema }, { name: 'search', inputSchema: searchToolInputSchema }]);

  const result = await rpcResult(await site.application.handle(mcpRequest({ url: site.config.mcpResourceUrl, method: 'tools/call', token: site.token, params })));
  assert.deepEqual(result.content, [{ type: 'text', text: markdown }]);
  assert.notEqual(result.isError, true);
  const unauthenticated = await site.application.handle(mcpRequest({ url: site.config.mcpResourceUrl, method: 'tools/call', params }));
  site.world.memberships = [];
  const revoked = await site.application.handle(mcpRequest({ url: site.config.mcpResourceUrl, method: 'tools/call', token: site.token, params }));
  assert.deepEqual([unauthenticated.status, revoked.status], [401, 403]);
  assert.equal(renderer.launches.length, 1);
  assert.match(site.completions()[0]?.operationId as string, generatedOperationIdPattern);
  assert.deepEqual(site.completions().map(({ durationMs: _duration, operationId: _operationId, ...record }) => record), [{
    event: 'mcp.tool.completed', authority: 'workos:client_placeholder', subject: 'user_fetch', tenantId: 'workos:client_placeholder:org_fetch',
    tool: params.name, status: 'success',
  }]);
  const steps = stepRecordsIn(site.lines.join('\n'));
  assert.deepEqual(steps.map(({ durationMs, ...record }) => {
    assert.ok(Number.isSafeInteger(durationMs) && (durationMs as number) >= 0);
    return record;
  }), [{ event: 'pipeline.step.completed', operationId: site.completions()[0]?.operationId, stepId: 'outgoing.observe_request', outcome: 'allowed' }, { event: 'pipeline.step.completed', operationId: site.completions()[0]?.operationId, stepId: 'incoming.process_html', outcome: 'allowed' }]);
  assert.ok(site.world.fake.takeRequests().every(({ method }) => method === 'GET'), 'Hosted fetch changed WorkOS data.');
  assert.doesNotMatch(site.lines.join('\n'), /private-query|private-fragment|private-hidden|Hosted story/);
  assert.ok(!site.lines.join('\n').includes(site.token));
});

test('Given one renderer active in production hosted composition, when another authorized request calls the tool, then it promptly gets a safe busy error and a busy completion, and a call after settlement can run', { timeout: 5_000 }, async (t) => {
  const site = await openHostedFetchSite(t, oneSlot);
  const renderer = controlledRenderer(t);
  t.after(() => renderer.finish(null, renderedOutput, ''));
  const call = () => site.application.handle(mcpRequest({ url: site.config.mcpResourceUrl, method: 'tools/call', token: site.token, params }));
  const first = call();
  await renderer.launched;
  const excess = await Promise.race([call().then(rpcResult), new Promise<never>((_resolve, reject) => { const timer = setTimeout(() => reject(new Error('The busy response did not arrive promptly')), 1_000); timer.unref(); })]);
  assert.deepEqual(excess.content, [{ type: 'text', text: 'Server busy. Try again later.' }]);
  assert.equal(excess.isError, true);
  assert.equal(renderer.execute.mock.callCount(), 1);
  renderer.finish(null, renderedOutput, '');
  assert.deepEqual((await rpcResult(await first)).content, [{ type: 'text', text: markdown }]);
  const next = call();
  while (renderer.execute.mock.callCount() < 2) await new Promise<void>((resolve) => setImmediate(resolve));
  renderer.finish(null, renderedOutput, '');
  assert.deepEqual((await rpcResult(await next)).content, [{ type: 'text', text: markdown }]);
  assert.deepEqual(site.completions().map(({ status }) => status), ['busy', 'success', 'success']);
  for (const record of site.completions()) assert.match(record.operationId as string, generatedOperationIdPattern);
  assert.equal(new Set(site.completions().map(({ operationId }) => operationId)).size, 3);
});

for (const outcome of ['failure', 'cancelled'] as const) {
  test(`Given a production hosted fetch with ${outcome}, when another call arrives before the renderer settles, then busy is returned until cleanup completes and the next call can render`, { timeout: 5_000 }, async (t) => {
    const site = await openHostedFetchSite(t, oneSlot);
    const renderer = controlledRenderer(t);
    t.after(() => renderer.finish(null, renderedOutput, ''));
    const controller = new AbortController();
    const call = (signal?: AbortSignal) => site.application.handle(mcpRequest({ url: site.config.mcpResourceUrl, method: 'tools/call', token: site.token, params, signal }));
    const first = call(controller.signal);
    const settled = first.then((response) => response.text(), () => 'disconnected');
    await renderer.launched;
    if (outcome === 'cancelled') {
      controller.abort();
      await new Promise<void>((resolve) => setImmediate(resolve));
      assert.deepEqual(renderer.child.signals, ['SIGKILL']);
    }
    const busy = await rpcResult(await call());
    assert.equal(busy.isError, true);
    assert.deepEqual(busy.content, [{ type: 'text', text: 'Server busy. Try again later.' }]);
    assert.equal(renderer.execute.mock.callCount(), 1);
    renderer.finish(Object.assign(new Error('private-renderer-failure'), { code: 22 }), JSON.stringify({ url, http_status: 404, content: '', error: 'HttpError' }), '');
    await settled;
    const next = call();
    while (renderer.execute.mock.callCount() < 2) await new Promise<void>((resolve) => setImmediate(resolve));
    renderer.finish(null, renderedOutput, '');
    assert.deepEqual((await rpcResult(await next)).content, [{ type: 'text', text: markdown }]);
    assert.deepEqual(site.completions().map(({ status }) => status), ['busy', outcome === 'failure' ? 'fetch_failed' : 'cancelled', 'success']);
    for (const record of site.completions()) assert.match(record.operationId as string, generatedOperationIdPattern);
    assert.equal(new Set(site.completions().map(({ operationId }) => operationId)).size, 3);
    assert.equal(site.lines.filter((line) => line.startsWith('{\"event\":\"renderer.fetch.failed\"')).length, outcome === 'failure' ? 1 : 0);
    assert.doesNotMatch(site.lines.join('\n'), /private-query|private-fragment|private-renderer-failure/);
  });
}

for (const era of mcpProtocolEras) {
  test(`Given empty, hidden-only, ad-only, withheld, oversized, deep, and failed pages in ${era}, when a real hosted user fetches them, then exact output and truthful incoming records join one completion per call`, { timeout: 30_000 }, async (t) => {
    const site = await openHostedFetchSite(t);
    const renderer = RendererProcessDouble.install(t);
    for (const { name, html } of incomingPageCases) renderer.serve(`https://source.example/${name}`, { finalUrl: `https://news.example/${name}`, html });
    const pipeline = t.mock.method(HtmlToMarkdownPipeline.prototype, 'process');
    const client = await connectMcpClient(t, new StreamableHTTPClientTransport(new URL(site.config.mcpResourceUrl), {
      authProvider: { token: async () => site.token },
      fetch: async (input, init) => site.application.handle(new Request(input, init)),
    }), { era });
    t.after(() => client.close());
    const call = (url: string) => client.callTool({ name: 'getURLAsMarkdown', arguments: { url, reason: 'Read the page' } });

    for (const { name, text } of incomingPageCases) {
      const result = await call(`https://source.example/${name}`);
      assert.deepEqual(result.content, [{ type: 'text', text }]);
      assert.equal(result.isError === true, text !== '');
      assert.equal(result.structuredContent, undefined);
    }
    const failure = await call('https://source.example/missing');
    assert.deepEqual(failure.content, [{ type: 'text', text: 'Page fetch failed: HTTP 404' }]);
    assert.equal(failure.isError, true);

    const completions = site.completions();
    assert.equal(completions.length, incomingPageCases.length + 1);
    assert.equal(new Set(completions.map(({ operationId }) => operationId)).size, completions.length);
    assert.deepEqual(completions.map(({ status }) => status), [...incomingPageCases.map(({ text }) => text ? 'processing_failed' : 'success'), 'fetch_failed']);
    assert.equal(pipeline.mock.callCount(), incomingPageCases.length - 1);
    assert.ok(pipeline.mock.calls.every(({ arguments: [page] }) => !page.requestedUrl.endsWith('/oversize')));
    const steps = stepRecordsIn(site.lines.join('\n'));
    assert.equal(steps.length, incomingPageCases.length * 2 + 1);
    assert.deepEqual(steps.map(({ durationMs, ...record }) => {
      assert.ok(Number.isSafeInteger(durationMs) && (durationMs as number) >= 0);
      return record;
    }), [
      ...incomingPageCases.flatMap(({ text, code }, index) => [
        { event: 'pipeline.step.completed', operationId: completions[index].operationId, stepId: 'outgoing.observe_request', outcome: 'allowed' },
        { event: 'pipeline.step.completed', operationId: completions[index].operationId, stepId: 'incoming.process_html', outcome: text ? 'failed' : code ? 'blocked' : 'allowed', ...(code ? { code } : {}) },
      ]),
      { event: 'pipeline.step.completed', operationId: completions.at(-1)?.operationId, stepId: 'outgoing.observe_request', outcome: 'allowed' },
    ]);
    for (const completion of completions) assert.match(completion.operationId as string, generatedOperationIdPattern);
    assert.doesNotMatch(JSON.stringify(steps), /private-|Visible text|Story|source|news|Bearer|warning/);
    assert.ok(!site.lines.join('\n').includes(site.token));
  });
}

const searchDescription = 'Search the web with a text query and return cleaned results as Markdown. Use this tool for web searches; search engines may block generic page-fetch requests. Use getURLAsMarkdown to read a result page. Give the reason the agent needs the search.';
const fetchDescription = 'Fetch a known web page URL as Markdown. For web searches, use search instead of fetching a search engine results URL. Give the reason the agent needs the page.';

for (const era of mcpProtocolEras) {
  test(`Given the production hosted application and an authorized user in ${era}, when the user discovers and calls search, then both tools have their guidance and schemas and the captured Brave results reach the client`, { timeout: 120_000 }, async (t) => {
    const site = await openHostedFetchSite(t);
    const searchUrl = 'https://search.brave.com/search?q=entry+wiring';
    const renderer = RendererProcessDouble.install(t);
    renderer.serve(searchUrl, { finalUrl: searchUrl, html: readFileSync(new URL('test/support/fixtures/search-engine/brave-results.html', repositoryRoot), 'utf8') });
    const client = await connectMcpClient(t, new StreamableHTTPClientTransport(new URL(site.config.mcpResourceUrl), {
      authProvider: { token: async () => site.token },
      fetch: async (input, init) => site.application.handle(new Request(input, init)),
    }), { era });
    t.after(() => client.close());
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })), [
      { name: 'getURLAsMarkdown', description: fetchDescription, inputSchema: fetchToolInputSchema },
      { name: 'search', description: searchDescription, inputSchema: searchToolInputSchema },
    ]);
    const result = await client.callTool({ name: 'search', arguments: { query: 'entry wiring', reason: 'Verify production search' } });
    assert.notEqual(result.isError, true);
    assert.equal(result.structuredContent, undefined);
    assert.equal(result.content.length, 1);
    const content = result.content[0];
    assert.equal(content.type, 'text');
    if (content.type !== 'text') throw new Error('Expected Markdown');
    const expected = JSON.parse(readFileSync(new URL('test/support/fixtures/search-engine/brave-results-expected.json', repositoryRoot), 'utf8')) as Array<{ title: string; url: string }>;
    for (const entry of expected) {
      assert.ok(content.text.includes(entry.title), `Missing result: ${entry.title}`);
      assert.ok(content.text.includes(entry.url), `Missing destination: ${entry.url}`);
    }
    assert.equal(renderer.launches.length, 1);
    assert.equal(renderer.launches[0]?.args.at(-1), searchUrl);
    assert.equal(site.completions().at(-1)?.status, 'success');
  });
}
